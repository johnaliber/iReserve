'use client';

import React from 'react';
import { 
  Save, 
  UploadCloud, 
  Undo2, 
  Redo2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Grid, 
  Grid3X3,
  Download,
  Upload,
  Play,
  Pencil,
  Copy,
  ClipboardPaste
} from 'lucide-react';

export default function EditorToolbar({
  onSaveDraft,
  onPublish,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  zoom,
  setZoom,
  gridEnabled,
  setGridEnabled,
  snapEnabled,
  setSnapEnabled,
  previewMode,
  setPreviewMode,
  undoEnabled,
  redoEnabled,
  copyEnabled,
  pasteEnabled,
  onExport,
  onImport
}) {
  const iconButton = 'flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30';
  const toggleButton = 'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition';

  return (
    <div className="editor-toolbar z-30 flex h-14 flex-shrink-0 select-none items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 shadow-sm">
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          onClick={onUndo}
          disabled={!undoEnabled}
          title="Undo"
          className={iconButton}
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!redoEnabled}
          title="Redo"
          className={iconButton}
        >
          <Redo2 className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button
          onClick={onCopy}
          disabled={!copyEnabled}
          title="Copy"
          className={iconButton}
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={onPaste}
          disabled={!pasteEnabled}
          title="Paste"
          className={iconButton}
        >
          <ClipboardPaste className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button
          onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))}
          title="Zoom out"
          className={iconButton}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-12 rounded-md bg-white px-2 py-1 text-center text-[11px] font-bold text-slate-700 shadow-sm">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
          title="Zoom in"
          className={iconButton}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          title="Reset zoom to 100%"
          className={iconButton}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setGridEnabled(!gridEnabled)}
          title="Toggle grid"
          className={`${toggleButton} ${
            gridEnabled
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Grid className="h-3.5 w-3.5" />
          <span>Grid</span>
        </button>
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          title="Toggle smart snapping"
          className={`${toggleButton} ${
            snapEnabled
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          <span>Snapping</span>
        </button>
        <button
          onClick={() => setPreviewMode(!previewMode)}
          className={`${toggleButton} ${
            previewMode
              ? 'border-emerald-300 bg-emerald-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {previewMode ? (
            <>
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Mode</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span>Preview</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button onClick={onExport} title="Export JSON" className={iconButton}>
            <Download className="h-4 w-4" />
          </button>
          <label title="Import JSON" className={`${iconButton} cursor-pointer`}>
            <Upload className="h-4 w-4" />
            <input type="file" onChange={onImport} accept=".json" className="hidden" />
          </label>
        </div>
        <button
          onClick={onSaveDraft}
          className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Save className="h-4 w-4" />
          <span>Save Draft</span>
        </button>
        <button
          onClick={onPublish}
          className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <UploadCloud className="h-4 w-4" />
          <span>Publish Map</span>
        </button>
      </div>
    </div>
  );
}
