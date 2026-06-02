'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import EditorToolbar from './EditorToolbar';
import ObjectToolbox from './ObjectToolbox';
import PropertiesPanel from './PropertiesPanel';
import LayersPanel from './LayersPanel';
import { Loader2, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

// Dynamically import CanvasStage with SSR disabled as Konva requires window context
const CanvasStage = dynamic(() => import('./CanvasStage'), { ssr: false });

export default function BlueprintEditor({ blueprintId, villageId }) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [blueprint, setBlueprint] = useState(null);
  const [objects, setObjects] = useState([]);
  
  // History Undo/Redo stacks
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Editor states
  const [activeTool, setActiveTool] = useState('select');
  const [zoom, setZoom] = useState(1);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', 'error'

  useEffect(() => {
    Promise.resolve().then(() => {
      if (selectedObjectIds.length > 0) {
        setSelectedObjectId(selectedObjectIds[selectedObjectIds.length - 1]);
      } else {
        setSelectedObjectId(null);
      }
    });
  }, [selectedObjectIds]);
  
  const [layersVisible, setLayersVisible] = useState({
    roads: true,
    lots: true,
    amenities: true,
    flood: true,
    sunlight: true
  });

  const fetchBlueprintData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch blueprint meta
      const { data: bp, error: bpError } = await supabase
        .from('blueprints')
        .select('*')
        .eq('id', blueprintId)
        .single();

      if (bpError || !bp) throw bpError || new Error('Blueprint not found');
      setBlueprint(bp);

      // 2. Fetch all objects mapped to this blueprint
      const { data: objs, error: objsError } = await supabase
        .from('blueprint_objects')
        .select('*')
        .eq('blueprint_id', blueprintId);

      if (objsError) throw objsError;
      
      let loadedObjects = objs || [];
      setObjects(loadedObjects);
      
      // Initialize history stack
      setHistory([JSON.stringify(loadedObjects)]);
      setHistoryIndex(0);
    } catch (error) {
      console.error('Error fetching blueprint data:', error);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  }, [blueprintId, supabase]);

  useEffect(() => {
    if (blueprintId) {
      Promise.resolve().then(() => {
        fetchBlueprintData();
      });
    }
  }, [blueprintId, fetchBlueprintData]);

  // Push new state onto history stack
  const updateObjectsWithHistory = useCallback((newObjects) => {
    setObjects(newObjects);
    const jsonStr = JSON.stringify(newObjects);
    
    // Clear out forward history if we were in the middle of undoing
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, jsonStr]);
    setHistoryIndex(newHistory.length);
  }, [history, historyIndex]);

  const handleDeleteObjects = useCallback((objIds) => {
    if (!objIds || objIds.length === 0) return;
    const filtered = objects.filter(o => !objIds.includes(o.id));
    updateObjectsWithHistory(filtered);
    setSelectedObjectIds([]);
  }, [objects, updateObjectsWithHistory]);

  // Global Keyboard Shortcuts for Drawing Tools
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore key events if the user is currently typing in input boxes or textareas
      if (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDeleteObjects(selectedObjectIds);
        return;
      }

      const key = e.key.toLowerCase();
      
      switch (key) {
        case 's':
        case '1':
          setActiveTool('select');
          break;
        case 'p':
        case '2':
          setActiveTool('pan');
          break;
        case 'r':
        case '3':
          setActiveTool('road_straight');
          break;
        case 'c':
        case '4':
          setActiveTool('road_curved');
          break;
        case 'l':
        case '5':
          setActiveTool('lot_polygon');
          break;
        case 'k':
        case '6':
          setActiveTool('lot_rect');
          break;
        case 't':
        case '7':
          setActiveTool('amenity_tree');
          break;
        case 'h':
        case '8':
          setActiveTool('amenity_clubhouse');
          break;
        case 'w':
        case '9':
          setActiveTool('amenity_pool');
          break;
        case 'g':
        case '0':
          setActiveTool('amenity_guard');
          break;
        case 'i':
          setActiveTool('amenity_light');
          break;
        case 'o':
        case 'x':
          setActiveTool('label_text');
          break;
        case 'f':
          setActiveTool('zone_flood');
          break;
        case 'n':
          setActiveTool('zone_noise');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedObjectIds, objects, handleDeleteObjects]);


  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setObjects(JSON.parse(history[prevIdx]));
      setSelectedObjectId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setObjects(JSON.parse(history[nextIdx]));
      setSelectedObjectId(null);
    }
  };

  const handleUpdateObject = (updatedObj) => {
    const updated = objects.map(o => o.id === updatedObj.id ? updatedObj : o);
    updateObjectsWithHistory(updated);
  };

  const handleDeleteObject = (objId) => {
    const filtered = objects.filter(o => o.id !== objId);
    updateObjectsWithHistory(filtered);
    setSelectedObjectId(null);
    setSelectedObjectIds([]);
  };

  // 1. SAVE DRAFT
  const handleSaveDraft = async () => {
    setSaveStatus('saving');
    try {
      // Synchronize database records. We will delete old ones and batch insert the current set.
      // This is the cleanest, most performant way to manage the object state batching.
      const { error: deleteError } = await supabase
        .from('blueprint_objects')
        .delete()
        .eq('blueprint_id', blueprintId);

      if (deleteError) throw deleteError;

      if (objects.length > 0) {
        const insertPayload = objects.map(obj => {
          const payloadObj = {
            village_id: villageId,
            blueprint_id: blueprintId,
            object_type: obj.object_type,
            object_data: obj.object_data,
            linked_property_id: obj.linked_property_id || null,
            layer_order: obj.layer_order || 0,
            is_visible: obj.is_visible !== false,
            is_locked: obj.is_locked === true
          };

          const isNew = typeof obj.id === 'string' && (
            obj.id.startsWith('mock-') || 
            obj.id.startsWith('road-') || 
            obj.id.startsWith('lot-') || 
            obj.id.startsWith('tree-') || 
            obj.id.startsWith('clubhouse-') || 
            obj.id.startsWith('pool-') || 
            obj.id.startsWith('guard-') || 
            obj.id.startsWith('light-') || 
            obj.id.startsWith('label-') || 
            obj.id.startsWith('zone-')
          );

          if (!isNew) {
            payloadObj.id = obj.id;
          }

          return payloadObj;
        });

        const { error: insertError } = await supabase
          .from('blueprint_objects')
          .insert(insertPayload);

        if (insertError) throw insertError;
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err) {
      console.error('Error saving draft:', err);
      setSaveStatus('error');
      throw err;
    }
  };

  // 2. PUBLISH MAP
  const handlePublish = async () => {
    setSaveStatus('saving');
    try {
      // First save draft state
      await handleSaveDraft();

      // Update blueprint status to 'published' and set published_at timestamp
      const { error: publishError } = await supabase
        .from('blueprints')
        .update({
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', blueprintId);

      if (publishError) throw publishError;

      setSaveStatus('published');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      console.error('Error publishing blueprint:', err);
      setSaveStatus('error');
    }
  };

  // Export layout into a downloadable JSON file
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(objects, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blueprint-${blueprint?.name || 'layout'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import layout from a uploaded JSON file
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          // Map to match current blueprintId and villageId context
          const formatted = imported.map(item => ({
            ...item,
            id: item.id || `imported-${Date.now()}-${Math.random()}`,
            blueprint_id: blueprintId,
            village_id: villageId
          }));
          updateObjectsWithHistory(formatted);
        }
      } catch (err) {
        alert('Invalid blueprint JSON configuration file.');
      }
    };
    reader.readAsText(file);
  };

  const handleLoadDemo = () => {
    if (confirm('Are you sure you want to load the starter layout template? This will replace your current workspace drawing.')) {
      const demoObjs = getMockObjects(blueprint?.village_id || villageId, blueprintId);
      updateObjectsWithHistory(demoObjs);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">Loading blueprint canvas...</span>
      </div>
    );
  }

  const selectedObject = objects.find(o => o.id === selectedObjectId);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
      
      {/* 1. Header toolbar */}
      <EditorToolbar
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        setZoom={setZoom}
        gridEnabled={gridEnabled}
        setGridEnabled={setGridEnabled}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        undoEnabled={historyIndex > 0}
        redoEnabled={historyIndex < history.length - 1}
        onExport={handleExport}
        onImport={handleImport}
        onLoadDemo={handleLoadDemo}
      />

      {/* Save Status Notification Overlay */}
      {saveStatus && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-2xl backdrop-blur bg-slate-900/90 text-xs font-semibold select-none animate-bounce">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span className="text-slate-200">Saving layout to cloud...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Draft saved successfully!</span>
            </>
          )}
          {saveStatus === 'published' && (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Blueprint published live!</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400">Error synchronizing database.</span>
            </>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* 2. Left side Toolbox */}
        {!previewMode && (
          <ObjectToolbox activeTool={activeTool} setActiveTool={setActiveTool} />
        )}

        {/* 3. Center Canvas Stage wrapper */}
        <div className="flex-1 h-full flex flex-col relative">
          {/* Blueprint Name Title Header bar */}
          <div className="h-10 bg-slate-950 border-b border-slate-900 px-4 flex items-center justify-between text-xs text-slate-500 font-semibold select-none">
            <span className="text-slate-400 flex items-center gap-1.5">
              {previewMode ? (
                <button
                  onClick={() => setPreviewMode(false)}
                  className="hover:text-emerald-400 transition flex items-center gap-0.5 cursor-pointer outline-none font-semibold border-none bg-transparent"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Editor
                </button>
              ) : (
                <Link href="/architect/dashboard" className="hover:text-emerald-400 transition flex items-center gap-0.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </Link>
              )}
              / {blueprint?.name}
            </span>
            <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase tracking-wider">
              Status: {blueprint?.status}
            </span>
          </div>

          <CanvasStage
            objects={objects}
            setObjects={updateObjectsWithHistory}
            activeTool={previewMode ? 'select' : activeTool}
            setActiveTool={setActiveTool}
            zoom={zoom}
            setZoom={setZoom}
            gridEnabled={gridEnabled}
            snapEnabled={snapEnabled}
            previewMode={previewMode}
            selectedObjectId={selectedObjectId}
            setSelectedObjectId={setSelectedObjectId}
            selectedObjectIds={selectedObjectIds}
            setSelectedObjectIds={setSelectedObjectIds}
            multiSelectEnabled={activeTool === 'multi_select'}
            layersVisible={layersVisible}
            onSaveDraft={handleSaveDraft}
          />
        </div>

        {/* 4. Right side Panels */}
        {!previewMode && (
          <div className="flex flex-col border-l border-slate-800/80 divide-y divide-slate-800/80">
            <PropertiesPanel
              selectedObject={selectedObject}
              onUpdateObject={handleUpdateObject}
              onDeleteObject={handleDeleteObject}
              villageId={villageId}
            />
            <div className="p-4 bg-slate-900">
              <LayersPanel layers={layersVisible} setLayers={setLayersVisible} />
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}

// Fallback visual blueprint dataset template for new or unseeded villages
const getMockObjects = (vId, bpId) => [
  {
    id: 'mock-road-1',
    village_id: vId,
    blueprint_id: bpId,
    object_type: 'road',
    layer_order: 1,
    is_visible: true,
    object_data: { name: 'Main Boulevard', points: [100, 250, 700, 250], width: 40, asphaltColor: '#e2e8f0', borderColor: '#334155', borderThickness: 6 }
  },
  {
    id: 'mock-road-2',
    village_id: vId,
    blueprint_id: bpId,
    object_type: 'road',
    layer_order: 1,
    is_visible: true,
    object_data: { name: 'Lake Side Alley', points: [350, 250, 350, 500], width: 25, asphaltColor: '#cbd5e1', borderColor: '#475569', borderThickness: 5 }
  },
  {
    id: 'mock-lot-1',
    village_id: vId,
    blueprint_id: bpId,
    object_type: 'lot',
    layer_order: 2,
    is_visible: true,
    linked_property_id: null,
    object_data: { name: 'Block A Lot 1', points: [120, 100, 220, 100, 220, 200, 120, 200], fillColor: '#10b981', borderColor: '#047857' }
  },
  {
    id: 'mock-lot-2',
    village_id: vId,
    blueprint_id: bpId,
    object_type: 'lot',
    layer_order: 2,
    is_visible: true,
    linked_property_id: null,
    object_data: { name: 'Block A Lot 2', points: [240, 100, 340, 100, 340, 200, 240, 200], fillColor: '#f59e0b', borderColor: '#d97706' }
  },
  {
    id: 'mock-lot-3',
    village_id: vId,
    blueprint_id: bpId,
    object_type: 'lot',
    layer_order: 2,
    is_visible: true,
    linked_property_id: null,
    object_data: { name: 'Block A Lot 3', points: [360, 100, 460, 100, 460, 200, 360, 200], fillColor: '#ef4444', borderColor: '#b91c1c' }
  },
  {
    id: 'mock-tree-1',
    village_id: vId,
    blueprint_id: bpId,
    object_type: 'tree',
    layer_order: 3,
    is_visible: true,
    object_data: { x: 500, y: 150, radius: 12, fill: '#059669' }
  },
  {
    id: 'mock-clubhouse',
    village_id: vId,
    blueprint_id: bpId,
    object_type: 'clubhouse',
    layer_order: 3,
    is_visible: true,
    object_data: { x: 550, y: 320, width: 90, height: 60, fill: '#0ea5e9', name: 'Lagoon Clubhouse' }
  },
  {
    id: 'mock-flood-zone',
    village_id: vId,
    blueprint_id: bpId,
    object_type: 'zone',
    layer_order: 0,
    is_visible: true,
    object_data: { label: 'High Flood Risk Zone', color: '#f43f5e', opacity: 0.25, points: [500, 100, 800, 100, 800, 220, 500, 220] }
  }
];

