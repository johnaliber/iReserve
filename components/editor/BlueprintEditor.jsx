'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import EditorToolbar from './EditorToolbar';
import ObjectToolbox from './ObjectToolbox';
import PropertiesPanel from './PropertiesPanel';
import LayersPanel from './LayersPanel';
import { Loader2, ArrowLeft, CheckCircle, AlertTriangle, Circle, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import Link from 'next/link';
import { prepareBlueprintObjectDuplicate } from '@/lib/editor/duplicateObject';

// Dynamically import CanvasStage with SSR disabled as Konva requires window context
const CanvasStage = dynamic(() => import('./CanvasStage'), { ssr: false });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatSupabaseError(err) {
  if (!err) return 'Unknown Supabase error.';
  if (typeof err === 'string') return err;

  const parts = [
    err.message,
    err.details,
    err.hint,
    err.code ? `Code: ${err.code}` : ''
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : JSON.stringify(err);
}
function createObjectId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`.replace('.', '-');
}

function normalizeMatchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function parseBlockLotFromObject(obj) {
  const data = obj?.object_data || {};
  const directBlock = normalizeMatchValue(data.block_number || data.blockNumber);
  const directLot = normalizeMatchValue(data.lot_number || data.lotNumber);

  if (directBlock && directLot) {
    return { block: directBlock, lot: directLot };
  }

  const text = String(data.name || data.label || '').toLowerCase();
  const verboseMatch = text.match(/block\s*([a-z0-9-]+).*lot\s*([a-z0-9-]+)/i);
  if (verboseMatch) {
    return {
      block: normalizeMatchValue(verboseMatch[1]),
      lot: normalizeMatchValue(verboseMatch[2])
    };
  }

  const shortMatch = text.match(/\bb\s*([a-z0-9-]+)\s*l\s*([a-z0-9-]+)/i);
  if (shortMatch) {
    return {
      block: normalizeMatchValue(shortMatch[1]),
      lot: normalizeMatchValue(shortMatch[2])
    };
  }

  return null;
}

function withPersistableIds(items) {
  return items.map((obj) => ({
    ...obj,
    id: UUID_RE.test(obj.id || '') ? obj.id : createObjectId()
  }));
}

function isImageFile(file) {
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file?.type);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => resolve(evt.target.result);
    reader.onerror = () => reject(new Error('Image could not be read.'));
    reader.readAsDataURL(file);
  });
}

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
  const [saveError, setSaveError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [clipboardObjects, setClipboardObjects] = useState([]);
  const [amenityShapeMode, setAmenityShapeMode] = useState('icon');
  const [duplicateNotice, setDuplicateNotice] = useState('');

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
    reference: true,
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
      setHasUnsavedChanges(false);
      
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

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Push new state onto history stack
  const updateObjectsWithHistory = useCallback((newObjects) => {
    setObjects(newObjects);
    setHasUnsavedChanges(true);
    const jsonStr = JSON.stringify(newObjects);
    
    // Clear out forward history if we were in the middle of undoing
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, jsonStr]);
    setHistoryIndex(newHistory.length);
  }, [history, historyIndex]);

  const updateObjectsLive = useCallback((newObjects) => {
    setObjects(newObjects);
    setHasUnsavedChanges(true);
  }, []);

  const handleDeleteObjects = useCallback((objIds) => {
    if (!objIds || objIds.length === 0) return;
    const filtered = objects.filter(o => !objIds.includes(o.id));
    updateObjectsWithHistory(filtered);
    setSelectedObjectIds([]);
  }, [objects, updateObjectsWithHistory]);

  const handleCopyObjects = useCallback(() => {
    if (!selectedObjectIds.length) return;

    const selectedSet = new Set(selectedObjectIds);
    const copiedObjects = objects
      .filter((object) => selectedSet.has(object.id))
      .map((object) => JSON.parse(JSON.stringify(object)));

    setClipboardObjects(copiedObjects);
  }, [objects, selectedObjectIds]);

  const handlePasteObjects = useCallback(() => {
    if (!clipboardObjects.length) return;

    const topLayer = objects.reduce(
      (highest, object) => Math.max(highest, object.layer_order || 0),
      0
    );
    const pastedObjects = clipboardObjects.map((object, index) => (
      prepareBlueprintObjectDuplicate(object, {
        id: createObjectId(),
        layerOrder: topLayer + index + 1,
        offset: 24
      })
    ));
    const pastedIds = pastedObjects.map((object) => object.id);
    const clearedPropertyDetails = pastedObjects.some(
      (object) => object.object_type === 'lot' || object.object_type === 'house'
    );

    updateObjectsWithHistory([...objects, ...pastedObjects]);
    setSelectedObjectIds(pastedIds);
    setSelectedObjectId(pastedIds[pastedIds.length - 1] || null);
    setClipboardObjects(pastedObjects);
    setDuplicateNotice(
      clearedPropertyDetails
        ? 'Object duplicated. Property details were not copied.'
        : 'Object duplicated.'
    );
    window.setTimeout(() => setDuplicateNotice(''), 3000);
  }, [clipboardObjects, objects, updateObjectsWithHistory]);

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

      if (e.ctrlKey || e.metaKey) {
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


  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setObjects(JSON.parse(history[prevIdx]));
      setSelectedObjectId(null);
      setSelectedObjectIds([]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setObjects(JSON.parse(history[nextIdx]));
      setSelectedObjectId(null);
      setSelectedObjectIds([]);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const handleHistoryShortcut = (e) => {
      const target = e.target;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'c') {
        e.preventDefault();
        handleCopyObjects();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'v') {
        e.preventDefault();
        handlePasteObjects();
      }
    };

    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [handleUndo, handleRedo, handleCopyObjects, handlePasteObjects]);

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
    setSaveError('');
    try {
      const resolvedVillageId = blueprint?.village_id || villageId;

      if (!resolvedVillageId) {
        throw new Error('Cannot save blueprint objects because the village scope is missing.');
      }

      // Synchronize database records. We will delete old ones and batch insert the current set.
      // This is the cleanest, most performant way to manage the object state batching.
      const { error: deleteError } = await supabase
        .from('blueprint_objects')
        .delete()
        .eq('blueprint_id', blueprintId);

      if (deleteError) throw deleteError;

      const { data: villageProperties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, block_number, lot_number')
        .eq('village_id', resolvedVillageId);

      if (propertiesError) throw propertiesError;

      const propertyByBlockLot = new Map(
        (villageProperties || []).map((prop) => [
          `${normalizeMatchValue(prop.block_number)}::${normalizeMatchValue(prop.lot_number)}`,
          prop.id
        ])
      );

      const objectsForSave = withPersistableIds(objects).map((obj) => {
        if (obj.linked_property_id || (obj.object_type !== 'lot' && obj.object_type !== 'house')) {
          return obj;
        }

        const blockLot = parseBlockLotFromObject(obj);
        if (!blockLot) return obj;

        const matchedPropertyId = propertyByBlockLot.get(`${blockLot.block}::${blockLot.lot}`);
        return matchedPropertyId ? { ...obj, linked_property_id: matchedPropertyId } : obj;
      });

      const linkedPropertyIds = objectsForSave
        .map((obj) => obj.linked_property_id)
        .filter(Boolean);

      if (objectsForSave.length > 0) {
        const insertPayload = objectsForSave.map(obj => {
          const payloadObj = {
            id: obj.id,
            village_id: resolvedVillageId,
            blueprint_id: blueprintId,
            object_type: obj.object_type,
            object_data: obj.object_data,
            linked_property_id: obj.linked_property_id || null,
            layer_order: obj.layer_order || 0,
            is_visible: obj.is_visible !== false,
            is_locked: obj.is_locked === true
          };

          return payloadObj;
        });

        const { error: insertError } = await supabase
          .from('blueprint_objects')
          .insert(insertPayload);

        if (insertError) throw insertError;
      }

      const duplicatedObjects = objectsForSave.filter((obj) => obj.duplicate_source_id);
      if (duplicatedObjects.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert(duplicatedObjects.map((obj) => ({
            user_id: user?.id || null,
            village_id: resolvedVillageId,
            action: 'blueprint_object_duplicated',
            entity_type: 'blueprint_object',
            entity_id: obj.id,
            metadata: {
              original_object_id: obj.duplicate_source_id,
              copied_visual_only: true,
              linked_property_cleared: true
            }
          })));

        if (auditError) {
          console.warn('Blueprint duplicate audit logging skipped:', formatSupabaseError(auditError));
        }
      }

      const { error: unlinkPropertiesError } = await supabase
        .from('properties')
        .update({ blueprint_object_id: null })
        .eq('village_id', resolvedVillageId)
        .not('blueprint_object_id', 'is', null);

      if (unlinkPropertiesError) {
        console.warn('Property link reset skipped:', formatSupabaseError(unlinkPropertiesError));
      }

      for (const propertyId of linkedPropertyIds) {
        const linkedObject = objectsForSave.find((obj) => obj.linked_property_id === propertyId);
        const persistedObjectId = linkedObject?.id;

        if (persistedObjectId) {
          const { error: linkError } = await supabase
            .from('properties')
            .update({ blueprint_object_id: persistedObjectId })
            .eq('id', propertyId);

          if (linkError) {
            console.warn('Property link sync skipped:', formatSupabaseError(linkError));
          }
        }
      }

      setObjects(objectsForSave.map(({ duplicate_source_id, ...obj }) => obj));
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err) {
      const message = formatSupabaseError(err);
      console.error('Error saving draft:', message, err);
      setSaveError(message);
      setSaveStatus('error');
      throw new Error(message);
    }
  };

  // 2. PUBLISH MAP
  const handlePublish = async () => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      // First save draft state
      await handleSaveDraft();

      const response = await fetch('/api/architect/blueprints/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprintId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The blueprint could not be published.');

      setBlueprint((prev) => prev ? { ...prev, ...payload.blueprint } : payload.blueprint);
      setSaveStatus('published');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (err) {
      const message = formatSupabaseError(err);
      console.error('Error publishing blueprint:', message, err);
      setSaveError(message);
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

  const handleAddImageLayerFile = useCallback(async (file, position = { x: 80, y: 80 }) => {
    if (!file) return;
    if (!isImageFile(file)) {
      alert('Please upload a PNG, JPG, JPEG, or WEBP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Please upload an image smaller than 10MB.');
      return;
    }

    const objectId = createObjectId();
    let imageUrl = '';

    try {
      const safeName = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
      const storagePath = `blueprints/${blueprintId}/${objectId}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('blueprint-assets')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('blueprint-assets').getPublicUrl(storagePath);
      imageUrl = data.publicUrl;
    } catch (error) {
      console.warn('Image layer storage upload failed; using local data URL fallback.', error);
      imageUrl = await readFileAsDataUrl(file);
    }

      const imageObject = {
        id: objectId,
        village_id: villageId,
        blueprint_id: blueprintId,
        object_type: 'image_layer',
        layer_order: 0,
        is_visible: true,
        is_locked: false,
        object_data: {
          kind: 'image_layer',
          name: file.name,
          image_url: imageUrl,
          imageUrl,
          x: Math.round(position.x || 80),
          y: Math.round(position.y || 80),
          width: 760,
          height: 520,
          rotation: 0,
          opacity: 0.6,
          showInEditor: true,
          showInAdminPreview: true,
          showInPublicMap: true,
          preserveOnPublish: true
        }
      };

      updateObjectsWithHistory([imageObject, ...objects]);
      setSelectedObjectIds([imageObject.id]);
      setSelectedObjectId(imageObject.id);
  }, [blueprintId, objects, supabase, updateObjectsWithHistory, villageId]);

  const handleAddImageLayer = (e) => {
    const file = e.target.files?.[0];
    handleAddImageLayerFile(file);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f1f5f9] text-[#475569]">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-emerald-600" />
        <span className="text-sm font-semibold">Loading blueprint canvas...</span>
      </div>
    );
  }

  const selectedObject = objects.find(o => o.id === selectedObjectId);

  return (
    <div className="blueprint-editor-compact relative flex h-dvh flex-col overflow-hidden bg-[#f1f5f9] text-[#0f172a]">
      
      {/* 1. Header toolbar */}
      <EditorToolbar
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCopy={handleCopyObjects}
        onPaste={handlePasteObjects}
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
        copyEnabled={selectedObjectIds.length > 0}
        pasteEnabled={clipboardObjects.length > 0}
        onExport={handleExport}
        onImport={handleImport}
      />

      {/* Save Status Notification Overlay */}
      {saveStatus && (
        <div className="absolute left-1/2 top-16 z-50 flex -translate-x-1/2 select-none items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-xl backdrop-blur">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span>Saving layout to cloud...</span>
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
              <span className="text-red-400">{saveError || 'Error synchronizing database.'}</span>
            </>
          )}
        </div>
      )}

      {duplicateNotice && (
        <div className="absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-xl">
          {duplicateNotice}
        </div>
      )}

      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden relative">
        {/* 2. Left side Toolbox */}
        {!previewMode && (
          leftPanelCollapsed ? (
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              title="Show tools panel"
              className="w-10 flex-shrink-0 border-r border-slate-800/80 bg-white text-slate-500 transition hover:text-emerald-600"
            >
              <PanelLeftOpen className="mx-auto h-5 w-5" />
            </button>
          ) : (
            <div className="relative h-full min-h-0 flex-shrink-0 border-r border-slate-200 bg-white">
              <button
                onClick={() => setLeftPanelCollapsed(true)}
                title="Collapse tools panel"
                className="absolute right-2 top-2 z-10 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              <ObjectToolbox
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                amenityShapeMode={amenityShapeMode}
                setAmenityShapeMode={setAmenityShapeMode}
              />
            </div>
          )
        )}

        {/* 3. Center Canvas Stage wrapper */}
        <div className="min-w-0 flex-1 h-full flex flex-col relative overflow-hidden">
          {/* Blueprint Name Title Header bar */}
          <div className="flex h-11 flex-shrink-0 select-none items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600">
            <span className="flex min-w-0 items-center gap-1.5">
              {previewMode ? (
                <button
                  onClick={() => setPreviewMode(false)}
                  className="flex cursor-pointer items-center gap-1 border-none bg-transparent font-semibold text-slate-600 outline-none transition hover:text-emerald-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Editor
                </button>
              ) : (
                <Link href="/architect/dashboard" className="flex items-center gap-1 transition hover:text-emerald-700">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </Link>
              )}
              <span className="text-slate-400">/</span>
              <span className="truncate font-bold text-slate-900">{blueprint?.name}</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                {blueprint?.status}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                hasUnsavedChanges
                  ? 'border border-amber-200 bg-amber-50 text-amber-800'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}>
                <Circle className="w-2 h-2 fill-current" />
                {hasUnsavedChanges ? 'Unsaved changes' : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : 'No changes'}
              </span>
            </div>
          </div>

          <CanvasStage
            objects={objects}
            setObjects={updateObjectsLive}
            commitObjects={updateObjectsWithHistory}
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
            onAddImageLayerFile={handleAddImageLayerFile}
            amenityShapeMode={amenityShapeMode}
          />
        </div>

        {/* 4. Right side Panels */}
        {!previewMode && (
          rightPanelCollapsed ? (
            <button
              onClick={() => setRightPanelCollapsed(false)}
              title="Show details panel"
              className="w-10 flex-shrink-0 border-l border-slate-800/80 bg-white text-slate-500 transition hover:text-emerald-600"
            >
              <PanelRightOpen className="mx-auto h-5 w-5" />
            </button>
          ) : (
            <div className="relative flex w-[336px] flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-slate-50">
              <button
                onClick={() => setRightPanelCollapsed(true)}
                title="Collapse details panel"
                className="absolute right-3 top-3 z-20 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:text-emerald-600"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
              <PropertiesPanel
                selectedObject={selectedObject}
                onUpdateObject={handleUpdateObject}
                onDeleteObject={handleDeleteObject}
                villageId={villageId}
              />
              <div className="border-t border-slate-200 bg-slate-50 p-3">
                <LayersPanel
                  objects={objects}
                  setObjects={updateObjectsWithHistory}
                  selectedObjectId={selectedObjectId}
                  setSelectedObjectId={setSelectedObjectId}
                  setSelectedObjectIds={setSelectedObjectIds}
                  onAddImageLayer={handleAddImageLayer}
                />
              </div>
            </div>
          )
        )}
      </div>
      
    </div>
  );
}
