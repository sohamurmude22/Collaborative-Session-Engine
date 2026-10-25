import React, { useState, useEffect } from 'react';
import { IFile, ISession } from '../types/cse.js';
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
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>Session File Storage</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
                {files.length}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Shared C++ storage &middot; Visible to all participants
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownloadAll}
            title="Download all stored files as JSON archive"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 border border-slate-700 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px] font-medium">Export All</span>
          </button>

          {canManageFiles && (
            <button
              type="button"
              onClick={() => {
                setNewFileName(`file_${files.length + 1}.cpp`);
                setShowAddModal(true);
              }}
              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1 shadow-sm transition cursor-pointer font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Add .cpp File</span>
            </button>
          )}
        </div>
      </div>

      {/* Storage Volume Stats */}
      <div className="grid grid-cols-2 gap-2 px-3 py-2 bg-slate-950/40 border-b border-slate-800/80 text-[11px]">
        <div className="flex items-center justify-between px-2 py-1 bg-slate-900/70 rounded-lg border border-slate-800">
          <span className="text-slate-400">Total Volume:</span>
          <span className="font-mono font-semibold text-slate-200">
            {(totalBytes / 1024).toFixed(1)} KB
          </span>
        </div>
        <div className="flex items-center justify-between px-2 py-1 bg-slate-900/70 rounded-lg border border-slate-800">
          <span className="text-slate-400">Total Lines:</span>
          <span className="font-mono font-semibold text-slate-200">{totalLines}</span>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {files.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-500 text-xs">
            <FolderArchive className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
            <p className="font-medium">No files in session storage</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {canManageFiles ? 'Click "Add .cpp File" to store source code.' : 'Files will appear here.'}
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
                    ? 'bg-indigo-950/50 border-indigo-500/50 shadow-sm shadow-indigo-500/10'
                    : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <FileCode className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                    
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
                          className="px-2 py-0.5 text-xs font-mono bg-slate-950 border border-indigo-500 text-white rounded focus:outline-none w-full"
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
                          className="p-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono uppercase">
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
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-indigo-300 transition"
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
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                      >
                        {copiedId === file.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSingle(file);
                        }}
                        title="Download file"
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{fileLines} lines &middot; {fileSize} bytes</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-sans ${
                    file.permission === 'LOCKED'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : file.permission === 'VISIBLE_READONLY'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Create New C++ File</h3>
            <p className="text-xs text-slate-400 mb-3">
              Add a new .cpp source or header file to the session workspace.
            </p>
            <form onSubmit={handleCreateFile} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. solution.cpp, utils.cpp"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer transition disabled:opacity-50"
                >
                  {adding ? 'Creating...' : 'Create .cpp File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
