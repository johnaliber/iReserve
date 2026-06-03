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
  Sparkles,
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
  onImport,
  onLoadDemo
}) {
  return (
    <div className="h-14 flex-shrink-0 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between gap-4 select-none z-20 shadow-sm">
      
      {/* 1. Left Action: Undo, Redo, Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!undoEnabled}
          title="Undo"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition outline-none cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!redoEnabled}
          title="Redo"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition outline-none cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-slate-200 mx-2" />

        <button
          onClick={onCopy}
          disabled={!copyEnabled}
          title="Copy"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition outline-none cursor-pointer"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onPaste}
          disabled={!pasteEnabled}
          title="Paste"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition outline-none cursor-pointer"
        >
          <ClipboardPaste className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-slate-200 mx-2" />

        <button
          onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
          title="Zoom In"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition outline-none cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-extrabold text-slate-600 min-w-10 text-center uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))}
          title="Zoom Out"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition outline-none cursor-pointer"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          title="Fit to Screen (100%)"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition outline-none cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Center: Snapping and Grids */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setGridEnabled(!gridEnabled)}
          title="Toggle Grid Lines"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition outline-none cursor-pointer shadow-sm ${
            gridEnabled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-100/20'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>

        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          title="Toggle Smart Snapping"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition outline-none cursor-pointer shadow-sm ${
            snapEnabled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-100/20'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          <span>Snapping</span>
        </button>



        <div className="h-4 w-[1px] bg-slate-200 mx-1.5" />

        <button
          onClick={() => setPreviewMode(!previewMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-extrabold transition outline-none cursor-pointer shadow-sm ${
            previewMode
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-emerald-100/20'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          {previewMode ? (
            <>
              <Pencil className="w-3.5 h-3.5 text-emerald-600" />
              <span>Edit Mode</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-slate-500" />
              <span>Preview</span>
            </>
          )}
        </button>

        {!previewMode && onLoadDemo && (
          <button
            onClick={onLoadDemo}
            title="Load Starter Demo Map Layout"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 transition-all duration-200 text-xs font-extrabold shadow-sm outline-none cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            <span>Load Demo Template</span>
          </button>
        )}
      </div>

      {/* 3. Right: Export, Import, Save Draft, Publish */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          title="Export JSON"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 hover:border-slate-200 transition outline-none cursor-pointer shadow-sm bg-white"
        >
          <Download className="w-4 h-4" />
        </button>
        
        <label className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 hover:border-slate-200 transition outline-none cursor-pointer shadow-sm bg-white">
          <Upload className="w-4 h-4" />
          <input type="file" onChange={onImport} accept=".json" className="hidden" />
        </label>

        <div className="h-4 w-[1px] bg-slate-200 mx-1" />

        <button
          onClick={onSaveDraft}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition outline-none cursor-pointer"
        >
          <Save className="w-3.5 h-3.5 text-slate-500" />
          <span>Save Draft</span>
        </button>
        <button
          onClick={onPublish}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:scale-[1.01] transition-all duration-150 outline-none cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5 text-white" />
          <span>Publish Map</span>
        </button>
      </div>

    </div>
  );
}
