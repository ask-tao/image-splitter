import { ref, onMounted, onUnmounted, computed, watch, nextTick, reactive, watchEffect, toRefs } from 'vue';
import type { UploadFile, DropdownInstance } from 'element-plus';
import { ElMessageBox } from 'element-plus';
import { ImageEditorState, type Box } from '../core/ImageEditorState';

export function useImageEditor() {
  // --- Core State ---
  const editorState = reactive(new ImageEditorState());

  // --- UI State ---
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const previewCanvasRef = ref<HTMLCanvasElement | null>(null);
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const ctxRef = ref<CanvasRenderingContext2D | null>(null);

  const selectedBoxId = ref<number | null>(null);

  // Interaction State
  const isDrawing = ref(false);
  const isMoving = ref(false);
  const isResizing = ref(false);
  const startX = ref(0);
  const startY = ref(0);
  const offsetX = ref(0);
  const offsetY = ref(0);
  const activeAnchor = ref<string | null>(null);
  const originalAspectRatio = ref(1);
  const cursorStyle = ref('default');

  // UI Control State
  const slicingMode = ref<'custom' | 'grid'>('custom');
  const canvasZoom = ref(100);
  const canvasPadding = ref(20);
  const autoDetectPadding = ref(0);
  const exportPrefix = ref('sprite');
  const exportConnector = ref('_');

  // Context Menu State
  const dropdownRef = ref<DropdownInstance | null>(null);
  const isMenuVisible = ref(false);
  const menuTop = ref(0);
  const menuLeft = ref(0);
  const rightClickedBoxId = ref<number | null>(null);

  // --- Computed properties ---
  const fileNamePreview = computed(() => {
    return `${exportPrefix.value}${exportConnector.value}1.png`;
  });

  // --- Drawing Logic ---
  const ANCHOR_SIZE = 8;
  const ANCHOR_COLOR = '#ffffff';
  const ANCHOR_STROKE_COLOR = '#007bff';

  const getAnchors = (box: Box) => {
    return {
      topLeft: { x: box.x, y: box.y },
      topMiddle: { x: box.x + box.w / 2, y: box.y },
      topRight: { x: box.x + box.w, y: box.y },
      middleLeft: { x: box.x, y: box.y + box.h / 2 },
      middleRight: { x: box.x + box.w, y: box.y + box.h / 2 },
      bottomLeft: { x: box.x, y: box.y + box.h },
      bottomMiddle: { x: box.x + box.w / 2, y: box.y + box.h },
      bottomRight: { x: box.x + box.w, y: box.y + box.h },
    };
  };

  const draw = () => {
    const canvas = canvasRef.value;
    const ctx = ctxRef.value;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (editorState.sourceImage) {
      ctx.drawImage(editorState.sourceImage, canvasPadding.value, canvasPadding.value);

      if (slicingMode.value === 'custom') {
        editorState.boxes.forEach(box => {
          const isSelected = box.id === selectedBoxId.value;
          ctx.lineWidth = 2;
          ctx.strokeStyle = isSelected ? '#007bff' : '#FF0000';
          ctx.strokeRect(box.x, box.y, box.w, box.h);

          if (isSelected) {
            ctx.fillStyle = ANCHOR_COLOR;
            ctx.strokeStyle = ANCHOR_STROKE_COLOR;
            ctx.lineWidth = 2;
            const anchors = getAnchors(box);
            for (const key in anchors) {
              const anchor = anchors[key as keyof typeof anchors];
              ctx.fillRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
              ctx.strokeRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
            }
          }
        });
      } else if (slicingMode.value === 'grid' && editorState.gridArea) {
        const box = editorState.gridArea;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#007bff';
        ctx.strokeRect(box.x, box.y, box.w, box.h);

        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        const cellWidth = box.w / editorState.gridCols;
        for (let i = 1; i < editorState.gridCols; i++) {
          ctx.beginPath();
          ctx.moveTo(box.x + i * cellWidth, box.y);
          ctx.lineTo(box.x + i * cellWidth, box.y + box.h);
          ctx.stroke();
        }

        const cellHeight = box.h / editorState.gridRows;
        for (let i = 1; i < editorState.gridRows; i++) {
          ctx.beginPath();
          ctx.moveTo(box.x, box.y + i * cellHeight);
          ctx.lineTo(box.x + box.w, box.y + i * cellHeight);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.fillStyle = ANCHOR_COLOR;
        ctx.strokeStyle = ANCHOR_STROKE_COLOR;
        ctx.lineWidth = 2;
        const anchors = getAnchors(box);
        for (const key in anchors) {
          const anchor = anchors[key as keyof typeof anchors];
          ctx.fillRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
          ctx.strokeRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
        }
      }
    }
  };

  const updatePreview = () => {
    const previewCanvas = previewCanvasRef.value;
    if (!previewCanvas || !editorState.sourceImage) return;

    const container = previewCanvas.parentElement;
    if (!container) return;

    previewCanvas.width = container.clientWidth;
    previewCanvas.height = container.clientHeight;

    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (slicingMode.value === 'grid') return;

    const selectedBox = editorState.boxes.find(b => b.id === selectedBoxId.value);

    if (selectedBox && selectedBox.w > 0 && selectedBox.h > 0) {
      const aspectRatio = selectedBox.w / selectedBox.h;
      let drawW = previewCanvas.width;
      let drawH = drawW / aspectRatio;

      if (drawH > previewCanvas.height) {
        drawH = previewCanvas.height;
        drawW = drawH * aspectRatio;
      }

      const drawX = (previewCanvas.width - drawW) / 2;
      const drawY = (previewCanvas.height - drawH) / 2;

      previewCtx.drawImage(
        editorState.sourceImage,
        selectedBox.x - canvasPadding.value, selectedBox.y - canvasPadding.value, selectedBox.w, selectedBox.h,
        drawX, drawY, drawW, drawH
      );
    }
  };

  // --- Watchers for automatic redraw ---
  watchEffect(() => {
    if (canvasRef.value) {
      draw();
    }
  });

  watchEffect(() => {
    if (previewCanvasRef.value) {
      updatePreview();
    }
  });

  watch(slicingMode, () => {
    editorState.clearBoxes();
    selectedBoxId.value = null;
    editorState.clearGrid();
  });

  watch([() => editorState.gridRows, () => editorState.gridCols], () => {
    if (slicingMode.value === 'grid') draw();
  });

  const setupCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.value;
    if (!canvas) return;
    canvas.width = img.width + canvasPadding.value * 2;
    canvas.height = img.height + canvasPadding.value * 2;
    canvas.style.width = `${canvas.width * (canvasZoom.value / 100)}px`;
    canvas.style.height = `${canvas.height * (canvasZoom.value / 100)}px`;
  };

  watch(canvasPadding, (newPadding) => {
    if (editorState.sourceImage) setupCanvas(editorState.sourceImage);
  });

  watch(canvasZoom, (newZoom) => {
    const canvas = canvasRef.value;
    if (canvas && editorState.sourceImage) {
      canvas.style.width = `${(editorState.sourceImage.width + canvasPadding.value * 2) * (newZoom / 100)}px`;
      canvas.style.height = `${(editorState.sourceImage.height + canvasPadding.value * 2) * (newZoom / 100)}px`;
    }
  });

  // --- Event Handlers ---
  const handleFileChange = async (uploadFile: UploadFile) => {
    if (!uploadFile.raw || !uploadFile.raw.type.startsWith('image')) return;

    const performLoad = async () => {
      const img = await editorState.loadImage(uploadFile.raw!)
      setupCanvas(img);
      selectedBoxId.value = null;
    };

    if (editorState.sourceImage) {
      ElMessageBox.confirm('这会替换掉当前图片和所有选框，是否继续？', '警告', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      }).then(performLoad).catch(() => {});
    } else {
      performLoad();
    }
  };

  const getBoxAt = (x: number, y: number): Box | null => {
    for (let i = editorState.boxes.length - 1; i >= 0; i--) {
      const box = editorState.boxes[i];
      if (box.w > 0 && box.h > 0 && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        return box;
      }
    }
    return null;
  };

  const getAnchorAt = (x: number, y: number, box: Box): string | null => {
    const anchors = getAnchors(box);
    for (const key in anchors) {
      const anchor = anchors[key as keyof typeof anchors];
      if (x >= anchor.x - ANCHOR_SIZE / 2 && x <= anchor.x + ANCHOR_SIZE / 2 && y >= anchor.y - ANCHOR_SIZE / 2 && y <= anchor.y + ANCHOR_SIZE / 2) {
        return key;
      }
    }
    return null;
  };

  const onMouseDown = (e: MouseEvent) => {
    if (isMenuVisible.value) closeContextMenu();
    e.preventDefault();
    if (!canvasRef.value || !editorState.sourceImage) return;

    const rect = canvasRef.value.getBoundingClientRect();
    startX.value = (e.clientX - rect.left) / (canvasZoom.value / 100);
    startY.value = (e.clientY - rect.top) / (canvasZoom.value / 100);

    if (slicingMode.value === 'custom') {
      const selectedBox = editorState.boxes.find(b => b.id === selectedBoxId.value);
      if (selectedBox) {
        const anchor = getAnchorAt(startX.value, startY.value, selectedBox);
        if (anchor) {
          isResizing.value = true;
          activeAnchor.value = anchor;
          originalAspectRatio.value = selectedBox.w / selectedBox.h;
          return;
        }
      }

      const clickedBox = getBoxAt(startX.value, startY.value);
      if (clickedBox) {
        selectedBoxId.value = clickedBox.id;
        isMoving.value = true;
        offsetX.value = startX.value - clickedBox.x;
        offsetY.value = startY.value - clickedBox.y;
      } else {
        selectedBoxId.value = null;
        isDrawing.value = true;
        const newBox = editorState.addBox({ x: startX.value, y: startY.value, w: 0, h: 0 });
        selectedBoxId.value = newBox.id;
      }
    } else if (slicingMode.value === 'grid') {
      if (editorState.gridArea) {
        const anchor = getAnchorAt(startX.value, startY.value, editorState.gridArea);
        if (anchor) {
          isResizing.value = true;
          activeAnchor.value = anchor;
          originalAspectRatio.value = editorState.gridArea.w / editorState.gridArea.h;
          return;
        }
        if (startX.value >= editorState.gridArea.x && startX.value <= editorState.gridArea.x + editorState.gridArea.w &&
          startY.value >= editorState.gridArea.y && startY.value <= editorState.gridArea.y + editorState.gridArea.h) {
          isMoving.value = true;
          offsetX.value = startX.value - editorState.gridArea.x;
          offsetY.value = startY.value - editorState.gridArea.y;
          return;
        }
      }
      if (!editorState.gridArea) {
        isDrawing.value = true;
        editorState.gridArea = { id: Date.now(), x: startX.value, y: startY.value, w: 0, h: 0 };
      }
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!canvasRef.value || !editorState.sourceImage) return;
    const rect = canvasRef.value.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / (canvasZoom.value / 100);
    const currentY = (e.clientY - rect.top) / (canvasZoom.value / 100);

    let targetBox: Box | null = null;
    if (slicingMode.value === 'custom') {
      targetBox = editorState.boxes.find(b => b.id === selectedBoxId.value) || null;
    } else if (slicingMode.value === 'grid') {
      targetBox = editorState.gridArea;
    }

    // Update cursor style
    let cursor = 'default';
    if (targetBox) {
      const anchor = getAnchorAt(currentX, currentY, targetBox);
      if (anchor) {
        if (anchor === 'topLeft' || anchor === 'bottomRight') cursor = 'nwse-resize';
        else if (anchor === 'topRight' || anchor === 'bottomLeft') cursor = 'nesw-resize';
        else if (anchor === 'middleLeft' || anchor === 'middleRight') cursor = 'ew-resize';
        else if (anchor === 'topMiddle' || anchor === 'bottomMiddle') cursor = 'ns-resize';
      } else if (getBoxAt(currentX, currentY) || (slicingMode.value === 'grid' && targetBox && currentX >= targetBox.x && currentX <= targetBox.x + targetBox.w && currentY >= targetBox.y && currentY <= targetBox.y + targetBox.h)) {
        cursor = 'move';
      }
    }
    cursorStyle.value = cursor;

    // Handle moving and resizing
    if (isResizing.value && targetBox) {
        const originalX = targetBox.x;
        const originalY = targetBox.y;
        const originalW = targetBox.w;
        const originalH = targetBox.h;
        let newX = targetBox.x, newY = targetBox.y, newW = targetBox.w, newH = targetBox.h;

        switch (activeAnchor.value) {
            case 'topLeft': { newX = currentX; newY = currentY; newW = originalX + originalW - currentX; newH = originalY + originalH - currentY; break; }
            case 'topRight': { newW = currentX - originalX; newY = currentY; newH = originalY + originalH - currentY; break; }
            case 'bottomLeft': { newX = currentX; newW = originalX + originalW - currentX; newH = currentY - originalY; break; }
            case 'bottomRight': { newW = currentX - originalX; newH = currentY - originalY; break; }
            case 'topMiddle': { newY = currentY; newH = originalY + originalH - currentY; break; }
            case 'bottomMiddle': { newH = currentY - originalY; break; }
            case 'middleLeft': { newX = currentX; newW = originalX + originalW - currentX; break; }
            case 'middleRight': { newW = currentX - originalX; break; }
        }
        if (newX < 0) { newW += newX; newX = 0; }
        if (newY < 0) { newH += newY; newY = 0; }
        if (newX + newW > canvasRef.value.width) { newW = canvasRef.value.width - newX; }
        if (newY + newH > canvasRef.value.height) { newH = canvasRef.value.height - newY; }
        targetBox.x = newX; targetBox.y = newY; targetBox.w = newW; targetBox.h = newH;
    } else if (isMoving.value && targetBox) {
        let newX = currentX - offsetX.value;
        let newY = currentY - offsetY.value;
        newX = Math.max(0, Math.min(newX, canvasRef.value.width - targetBox.w));
        newY = Math.max(0, Math.min(newY, canvasRef.value.height - targetBox.h));
        targetBox.x = newX;
        targetBox.y = newY;
    } else if (isDrawing.value) {
        const boxToDraw = slicingMode.value === 'custom' ? editorState.boxes[editorState.boxes.length - 1] : editorState.gridArea;
        if (boxToDraw) {
            boxToDraw.w = currentX - startX.value;
            boxToDraw.h = currentY - startY.value;
        }
    }
  };

  const onMouseUp = () => {
    if (!editorState.sourceImage) return;
    let subjectBox: Box | null = null;
    if (slicingMode.value === 'custom' && (isDrawing.value || isResizing.value)) {
      subjectBox = editorState.boxes.find(b => b.id === selectedBoxId.value) || null;
    } else if (slicingMode.value === 'grid' && (isDrawing.value || isResizing.value)) {
      subjectBox = editorState.gridArea;
    }

    if (subjectBox) {
      if (subjectBox.w < 0) { subjectBox.x += subjectBox.w; subjectBox.w = -subjectBox.w; }
      if (subjectBox.h < 0) { subjectBox.y += subjectBox.h; subjectBox.h = -subjectBox.h; }
      if (subjectBox.w < 5 || subjectBox.h < 5) {
        if (slicingMode.value === 'custom') {
          if (isDrawing.value) editorState.deleteBox(subjectBox.id);
          selectedBoxId.value = null;
        } else {
          editorState.clearGrid();
        }
      }
    }

    isDrawing.value = false;
    isMoving.value = false;
    isResizing.value = false;
    activeAnchor.value = null;
  };

  const onMouseLeave = () => {
    if (isDrawing.value || isMoving.value || isResizing.value) onMouseUp();
  };

  const onRightClick = async (e: MouseEvent) => {
    if (slicingMode.value === 'grid') return;
    if (!canvasRef.value || !editorState.sourceImage) return;

    const rect = canvasRef.value.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (canvasZoom.value / 100);
    const y = (e.clientY - rect.top) / (canvasZoom.value / 100);

    const clickedBox = getBoxAt(x, y);

    if (clickedBox) {
      rightClickedBoxId.value = clickedBox.id;
      menuTop.value = e.clientY;
      menuLeft.value = e.clientX;
      isMenuVisible.value = true;
      await nextTick();
      dropdownRef.value?.handleOpen();
    }
  };

  const closeContextMenu = () => { isMenuVisible.value = false; };

  const handleVisibleChange = (visible: boolean) => { if (!visible) closeContextMenu(); };

  const handleCommand = (command: string) => {
    if (rightClickedBoxId.value === null) return;
    if (command === 'deleteBox') {
      if (selectedBoxId.value === rightClickedBoxId.value) selectedBoxId.value = null;
      editorState.deleteBox(rightClickedBoxId.value);
    }
    closeContextMenu();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!editorState.sourceImage) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (slicingMode.value === 'grid' && editorState.gridArea) {
        e.preventDefault();
        editorState.clearGrid();
      } else if (slicingMode.value === 'custom' && selectedBoxId.value !== null) {
        e.preventDefault();
        editorState.deleteBox(selectedBoxId.value);
        selectedBoxId.value = null;
      }
    }
  };

  const handleClearAll = () => {
    if (slicingMode.value === 'custom') {
      if (editorState.boxes.length === 0) return;
      ElMessageBox.confirm('此操作将清除所有手动和自动生成的选框，是否继续？', '警告', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      }).then(() => {
        editorState.clearBoxes();
        selectedBoxId.value = null;
      }).catch(() => {});
    } else if (slicingMode.value === 'grid') {
      editorState.clearGrid();
    }
  };

  const handleAutoDetect = () => {
    const canvas = canvasRef.value;
    if (!canvas || !editorState.sourceImage) return;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCanvas.width = editorState.sourceImage.width;
    tempCanvas.height = editorState.sourceImage.height;
    tempCtx.drawImage(editorState.sourceImage, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    editorState.autoDetect(imageData, autoDetectPadding.value, canvasPadding.value);
    selectedBoxId.value = null;
  };

  const handleExport = async () => {
    try {
      const zipBlob = await editorState.export(exportPrefix.value, exportConnector.value, slicingMode.value, canvasPadding.value);
      const a = document.createElement('a');
      const url = URL.createObjectURL(zipBlob);
      a.href = url;
      a.download = `${exportPrefix.value}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      ElMessageBox.alert(error.message, '导出失败', { type: 'error' });
    }
  };

  const onCanvasPlaceholderClick = () => fileInputRef.value?.click();
  const onFileSelected = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) handleFileChange({ raw: target.files[0] } as UploadFile);
  };
  const onDrop = (e: DragEvent) => {
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) handleFileChange({ raw: e.dataTransfer.files[0] } as UploadFile);
  };

  // --- Lifecycle Hooks ---
  onMounted(() => {
    const canvas = canvasRef.value;
    if (canvas) ctxRef.value = canvas.getContext('2d');
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', closeContextMenu);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('click', closeContextMenu);
  });

  return {
    // Refs to bind in template
    canvasRef,
    previewCanvasRef,
    fileInputRef,
    dropdownRef,

    // UI State
    cursorStyle,
    slicingMode,
    canvasZoom,
    canvasPadding,
    autoDetectPadding,
    exportPrefix,
    exportConnector,
    isMenuVisible,
    menuTop,
    menuLeft,

    // Computed State
    fileNamePreview,

    // Core state (making it available to the view)
    ...toRefs(editorState),
    selectedBoxId,

    // UI Action Handlers
    handleFileChange,
    onCanvasPlaceholderClick,
    onFileSelected,
    onDrop,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onRightClick,
    handleCommand,
    handleVisibleChange,
    handleClearAll,
    handleAutoDetect,
    handleExport,
    fitGridToImage: () => editorState.fitGridToImage(canvasPadding.value),
    clearGrid: editorState.clearGrid,
  };
}