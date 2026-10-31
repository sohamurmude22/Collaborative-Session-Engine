import React, { useState, useEffect } from 'react';
import { IFile } from '../types/cse.js';
import { fileService } from '../services/api.js';
import {
  FolderArchive,
  FileCode,
  Download,
  Plus,
  Eye,
  Lock,
  FileText,
  Clock,
  HardDrive,
  RefreshCw,
  Check,
  Copy,
  Pencil,
  X
} from 'lucide-react';

interface SessionFileStorageProps {
  sessionId: string;
  files?: IFile[];
  activeFileId?: string;
  isInterviewer: boolean;
  isCreator?: boolean;
  onSelectFile?: (file: IFile) => void;
  onRefreshFiles?: () => void;
  onFileCreated?: () => void;
}

export const SessionFileStorage: React.FC<SessionFileStorageProps> = ({
  sessionId,
  files: propFiles,
  activeFileId,
  isInterviewer,
  isCreator = false,
  onSelectFile,
  onRefreshFiles,
  onFileCreated
}) => {
  const [internalFiles, setInternalFiles] = useState<IFile[]>([]);
  const files = propFiles || internalFiles;

  useEffect(() => {
    if (!propFiles && sessionId) {
      fileService.getFiles(sessionId).then(setInternalFiles).catch(() => {});
    }
  }, [sessionId, propFiles]);

  const canManageFiles = isInterviewer || isCreator;

  const [showAddModal, setShowAddModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLang, setNewFileLang] = useState('cpp');
  const [adding, setAdding] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Rename states
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const handleDownloadSingle = (file: IFile) => {
    const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    if (!files.length) return;
    const bundle = {
      sessionId,
      downloadedAt: new Date().toISOString(),
      filesCount: files.length,
      files: files.map((f) => ({
        name: f.name,
        language: f.language,
        permission: f.permission,
        content: f.content,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      }))
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Session_${sessionId.slice(-6)}_Storage_Archive.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyFileContent = (file: IFile) => {
    navigator.clipboard.writeText(file.content || '');
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    try {
      setAdding(true);
      let cleanName = newFileName.trim();
      if (!cleanName.includes('.')) {
        cleanName += '.cpp';
      }
      await fileService.createFile(sessionId, {
        name: cleanName,
        language: cleanName.endsWith('.cpp') ? 'cpp' : newFileLang,
        content: `// ${cleanName}\n#include <iostream>\n\n`,
        permission: 'VISIBLE_EDITABLE'
      });
      setNewFileName('');
      setShowAddModal(false);
      onRefreshFiles?.();
      onFileCreated?.();
      if (!propFiles && sessionId) {
        fileService.getFiles(sessionId).then(setInternalFiles).catch(() => {});
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create file in storage.');
    } finally {
      setAdding(false);
    }
  };

  const handleStartRename = (file: IFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingFileId(file.id);
    setRenameValue(file.name);
  };

  const handleSaveRename = async (fileId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!renameValue.trim()) return;
    try {
      setIsRenaming(true);
      let cleanName = renameValue.trim();
      if (!cleanName.includes('.')) {
        cleanName += '.cpp';
      }
      await fileService.renameFile(fileId, cleanName);
      setRenamingFileId(null);
      onRefreshFiles?.();
      if (!propFiles && sessionId) {
        fileService.getFiles(sessionId).then(setInternalFiles).catch(() => {});
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to rename file.');
    } finally {
      setIsRenaming(false);
    }
  };

  const totalBytes = files.reduce((acc, f) => acc + (f.content ? new Blob([f.content]).size : 0), 0);
  const totalLines = files.reduce((acc, f) => acc + (f.content ? f.content.split('\n').length : 0), 0);

  return (
    <div className="flex flex-col h-full bg-white/70 dark:bg-[#0f172a]/70 border border-slate-200/80 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
      {/* Header */}
      <div className="p-3 bg-slate-50/80 dark:bg-black/30 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 font-heading">
              <span>File Storage</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                {files.length}
              </span>
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Workspace file system
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownloadAll}
            title="Download all stored files as JSON archive"
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1 border border-slate-200 dark:border-white/10 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px] font-medium">Export</span>
          </button>

          {canManageFiles && (
            <button
              type="button"
              onClick={() => {
                setNewFileName(`file_${files.length + 1}.cpp`);
                setShowAddModal(true);
              }}
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1 shadow-xs transition cursor-pointer font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">New File</span>
            </button>
          )}
        </div>
      </div>

      {/* Storage Volume Stats */}
      <div className="grid grid-cols-2 gap-2 px-3 py-2 bg-slate-100/50 dark:bg-black/20 border-b border-slate-200/80 dark:border-white/10 text-[11px]">
        <div className="flex items-center justify-between px-2 py-1 bg-white dark:bg-white/5 rounded-lg border border-slate-200/80 dark:border-white/5">
          <span className="text-slate-500 dark:text-slate-400">Volume:</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {(totalBytes / 1024).toFixed(1)} KB
          </span>
        </div>
        <div className="flex items-center justify-between px-2 py-1 bg-white dark:bg-white/5 rounded-lg border border-slate-200/80 dark:border-white/5">
          <span className="text-slate-500 dark:text-slate-400">Lines:</span>
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totalLines}</span>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {files.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-400 dark:text-slate-500 text-xs">
            <FolderArchive className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No files stored</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {canManageFiles ? 'Create or upload code files to begin.' : 'Session files will appear here.'}
            </p>
          </div>
        ) : (
          files.map((file) => {
            const isActive = file.id === activeFileId;
            const fileSize = file.content ? new Blob([file.content]).size : 0;
            const fileLines = file.content ? file.content.split('\n').length : 0;
            const isEditingThisFile = renamingFileId === file.id;

            return (
              <div
                key={file.id}
                onClick={() => onSelectFile?.(file)}
                className={`group p-2.5 rounded-xl border transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-500/10 border-indigo-500/50 shadow-xs'
                    : 'bg-white/60 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <FileCode className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />

                    {isEditingThisFile ? (
                      <form
                        onSubmit={(e) => handleSaveRename(file.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 flex-1"
                      >
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          className="px-2 py-0.5 text-xs font-mono bg-white dark:bg-[#090d16] border border-indigo-500 text-slate-900 dark:text-white rounded focus:outline-none w-full"
                          placeholder="filename.cpp"
                        />
                        <button
                          type="submit"
                          disabled={isRenaming}
                          className="px-2 py-0.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingFileId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono uppercase">
                          {file.language}
                        </span>
                      </>
                    )}
                  </div>

                  {!isEditingThisFile && (
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                      {canManageFiles && (
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(file, e)}
                          title="Rename file"
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-500 transition"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyFileContent(file);
                        }}
                        title="Copy content"
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      >
                        {copiedId === file.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSingle(file);
                        }}
                        title="Download file"
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>{fileLines} lines &middot; {fileSize} bytes</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-sans font-medium ${
                      file.permission === 'LOCKED'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                        : file.permission === 'VISIBLE_READONLY'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                    }`}
                  >
                    {file.permission === 'LOCKED' ? 'Locked' : file.permission === 'VISIBLE_READONLY' ? 'Read-Only' : 'Editable'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add File Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl p-5 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 font-heading">Create Source File</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Add a new source or header file to the session workspace.
            </p>
            <form onSubmit={handleCreateFile} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. solution.cpp, utils.h"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow-xs disabled:opacity-50"
                >
                  {adding ? 'Creating...' : 'Create File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
