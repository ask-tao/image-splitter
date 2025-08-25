import { reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ImageEditor } from '../core/ImageEditor';

/**
 * @description Core state management for the image editor.
 * This composable centralizes all reactive state related to the editor,
 * making it a single source of truth that can be injected into other composables.
 */
export function useCanvasState() {
  const { t } = useI18n();

  // --- Core Reactive State from Class ---
  const imageEditor = reactive(new ImageEditor(t));

  // --- UI Control State ---
  const slicingMode = ref<'custom' | 'grid'>('custom');
  const canvasZoom = ref(100);
  const canvasPadding = ref(20);
  const autoDetectPadding = ref(0);
  const exportPrefix = ref('sprite');
  const exportConnector = ref('_');
  const autoDetectMode = ref<'padding' | 'fixedSize'>('padding');

  // --- Selection and Interaction State ---
  const selectedBoxId = ref<number | null>(null);
  const cursorStyle = ref('default');

  return {
    // Core State
    imageEditor,

    // UI Controls
    slicingMode,
    canvasZoom,
    canvasPadding,
    autoDetectPadding,
    exportPrefix,
    exportConnector,
    autoDetectMode,

    // Interaction State
    selectedBoxId,
    cursorStyle,
  };
}

export type CanvasState = ReturnType<typeof useCanvasState>;
