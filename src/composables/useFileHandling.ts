import { ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { useI18n } from 'vue-i18n';
import type { CanvasState } from './useCanvasState';

/**
 * @description Handles file loading, dropping, and exporting.
 */
export function useFileHandling(
  state: CanvasState,
  setupCanvas: (img: HTMLImageElement) => void
) {
  const { t } = useI18n();
  const { imageEditor, exportPrefix, exportConnector, slicingMode, canvasPadding, selectedBoxId } = state;

  const handleFileChange = async (uploadFile: UploadFile) => {
    if (!uploadFile.raw || !uploadFile.raw.type.startsWith('image')) return;

    const performLoad = async () => {
      const img = await imageEditor.loadImage(uploadFile.raw!)
      setupCanvas(img);
      selectedBoxId.value = null;
    };

    if (imageEditor.sourceImage) {
      ElMessageBox.confirm(t('messages.replaceConfirmMsg'), t('messages.replaceConfirmTitle'), {
        confirmButtonText: t('messages.confirm'), cancelButtonText: t('messages.cancel'), type: 'warning',
      }).then(performLoad).catch(() => { });
    } else {
      performLoad();
    }
  };

  const handleExport = async () => {
    try {
      const zipBlob = await imageEditor.export(exportPrefix.value, exportConnector.value, slicingMode.value, canvasPadding.value);
      const a = document.createElement('a');
      const url = URL.createObjectURL(zipBlob);
      a.href = url;
      a.download = `${exportPrefix.value}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      ElMessageBox.alert(error.message, t('messages.exportErrorTitle'), { type: 'error' });
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); // Prevent default browser behavior
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleFileChange({ raw: e.dataTransfer.files[0] } as UploadFile);
    }
  };

  return {
    handleFileChange,
    handleExport,
    onDrop,
  };
}
