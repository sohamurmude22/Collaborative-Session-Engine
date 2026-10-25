/**
 * SessionRecordingService
 * Handles rolling 10-minute screen recording buffer using Web MediaRecorder API
 * and persistent storage in IndexedDB for post-session replay.
 */

const DB_NAME = 'CSE_RecordingsDB';
const STORE_NAME = 'session_screen_recordings';
const DB_VERSION = 1;
const MAX_BUFFER_DURATION_MS = 10 * 60 * 1000; // Past 10 minutes

export interface SavedScreenRecording {
  sessionId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  savedAt: number;
  recordedBy?: string;
}

interface TimestampedChunk {
  chunk: Blob;
  timestamp: number;
}

class SessionRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private chunks: TimestampedChunk[] = [];
  private recordingStartTime: number = 0;
  private isRecording: boolean = false;
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result as IDBDatabase);
      };

      request.onerror = (err) => {
        console.error('[SessionRecorder] IndexedDB open error:', err);
        reject(err);
      };
    });

    return this.dbPromise;
  }

  /**
   * Check if screen recording is actively buffering
   */
  public getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Request display media stream and start rolling 10-minute buffer
   */
  public async startRecording(sessionId: string): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen capture not supported in this browser environment');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser'
        } as any,
        audio: true
      });

      this.mediaStream = stream;
      this.chunks = [];
      this.recordingStartTime = Date.now();

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          const now = Date.now();
          this.chunks.push({ chunk: event.data, timestamp: now });

          // Prune chunks older than 10 minutes (600,000ms)
          const cutoff = now - MAX_BUFFER_DURATION_MS;
          while (this.chunks.length > 0 && this.chunks[0].timestamp < cutoff) {
            this.chunks.shift();
          }
        }
      };

      // Handle user stopping screen share via browser floating bar
      stream.getVideoTracks()[0].onended = () => {
        this.stopRecordingAndSave(sessionId, 'Auto-Saved on Stop');
      };

      // Request data chunks every 3 seconds for smooth rolling buffer
      recorder.start(3000);
      this.isRecording = true;
      return true;
    } catch (err: any) {
      console.warn('[SessionRecorder] Screen recording start cancelled or failed:', err.message);
      return false;
    }
  }

  /**
   * Stop recorder and save the past 10-minute screen recording into IndexedDB
   */
  public async stopRecordingAndSave(sessionId: string, recordedBy?: string): Promise<SavedScreenRecording | null> {
    if (!this.mediaRecorder && this.chunks.length === 0) return null;

    return new Promise((resolve) => {
      const finalizeSave = async () => {
        try {
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
          }
          this.isRecording = false;

          if (this.chunks.length === 0) {
            resolve(null);
            return;
          }

          const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
          const blobParts = this.chunks.map((c) => c.chunk);
          const finalBlob = new Blob(blobParts, { type: mimeType });

          const durationMs = Math.min(
            Date.now() - (this.chunks[0]?.timestamp || this.recordingStartTime),
            MAX_BUFFER_DURATION_MS
          );

          const savedData: SavedScreenRecording = {
            sessionId,
            blob: finalBlob,
            mimeType,
            durationMs,
            savedAt: Date.now(),
            recordedBy
          };

          await this.saveToIndexedDB(savedData);
          this.mediaRecorder = null;
          resolve(savedData);
        } catch (err) {
          console.error('[SessionRecorder] Error finalizing screen recording:', err);
          resolve(null);
        }
      };

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = finalizeSave;
        this.mediaRecorder.stop();
      } else {
        finalizeSave();
      }
    });
  }

  /**
   * Save a recording blob directly to IndexedDB
   */
  public async saveToIndexedDB(data: SavedScreenRecording): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data);

      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e);
    });
  }

  /**
   * Retrieve saved 10-minute screen recording for a session
   */
  public async getRecording(sessionId: string): Promise<SavedScreenRecording | null> {
    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(sessionId);

      req.onsuccess = (event: any) => {
        resolve(event.target.result || null);
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  }

  /**
   * Delete recording for session
   */
  public async deleteRecording(sessionId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(sessionId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  }
}

export const sessionRecordingService = new SessionRecordingService();
