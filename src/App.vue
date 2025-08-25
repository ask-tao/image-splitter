<template>
  <el-config-provider :locale="currentLocale">
    <el-container class="app-container">
      <el-header class="app-header">
        <a href="https://github.com/ask-tao/image-splitter" target="_blank" rel="noopener noreferrer" class="header-title-link">
          <div class="header-title-group">
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" class="header-logo">
              <defs>
                <linearGradient id="globalGrad" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#41D1FF"></stop>
                  <stop offset="100%" stop-color="#BD34FE"></stop>
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="98" height="98" rx="10" ry="10" fill="url(#globalGrad)"/>
              <rect x="102" y="0" width="98" height="98" rx="10" ry="10" fill="url(#globalGrad)"/>
              <rect x="0" y="102" width="98" height="98" rx="10" ry="10" fill="url(#globalGrad)"/>
              <rect x="102" y="102" width="98" height="98" rx="10" ry="10" fill="url(#globalGrad)"/>
            </svg>
            <h1>{{ $t('header.title') }}</h1>
          </div>
        </a>
        <div class="header-actions">
          <el-tooltip :content="$t('header.help')" placement="bottom">
            <span class="header-action-icon" @click="helpDialogVisible = true">
              <el-icon :size="22"><QuestionFilled /></el-icon>
            </span>
          </el-tooltip>
          <el-tooltip :content="$t('header.about')" placement="bottom">
            <span class="header-action-icon" @click="aboutDialogVisible = true">
              <el-icon :size="22"><InfoFilled /></el-icon>
            </span>
          </el-tooltip>
          <el-dropdown @command="handleLanguageChange" trigger="click">
            <span class="el-dropdown-link header-action-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path
                  d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z">
                </path>
              </svg>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="zh-CN" :disabled="locale === 'zh-CN'">简体中文</el-dropdown-item>
                <el-dropdown-item command="en" :disabled="locale === 'en'">English</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-switch v-model="isDarkMode" inline-prompt :active-icon="Moon" :inactive-icon="Sunny"
            style="--el-switch-on-color: #2c2c2c; --el-switch-off-color: #577fd8;" />
          <a href="https://github.com/ask-tao/image-splitter" target="_blank" rel="noopener noreferrer"
            class="github-link header-action-icon">
            <svg viewBox="0 0 1024 1024" width="24" height="24" fill="currentColor" v-html="githubSvgPath"></svg>
          </a>
        </div>
      </el-header>
      <el-container class="content-container">
        <el-aside width="350px" class="sidebar">
          <el-card shadow="always">
            <div class="control-panel">
              <el-upload class="upload-control" drag action="#" :show-file-list="false" :auto-upload="false"
                @change="handleFileChange">
                <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                <div class="el-upload__text" v-html="$t('upload.main')"></div>
              </el-upload>

              <el-divider>{{ $t('sidebar.edit') }}</el-divider>
              <el-form-item :label-width="labelWidth" :label="$t('sidebar.canvasZoom')">
                <el-slider v-model="canvasZoom" :min="10" :max="400" :step="10" show-input size="small" />
              </el-form-item>
              <el-form-item :label-width="labelWidth" :label="$t('sidebar.canvasPadding')">
                <el-slider v-model="canvasPadding" :min="0" :max="100" show-input size="small" />
              </el-form-item>
              <el-form-item :label-width="labelWidth" :label="$t('sidebar.slicingMode')">
                <el-radio-group v-model="slicingMode" size="small" class="slicing-mode-group">
                  <el-radio-button label="custom">{{ $t('sidebar.slicingModes.custom') }}</el-radio-button>
                  <el-radio-button label="grid">{{ $t('sidebar.slicingModes.grid') }}</el-radio-button>
                </el-radio-group>
              </el-form-item>

              <div v-if="slicingMode === 'custom'">
                <el-form-item :label-width="labelWidth" :label="$t('sidebar.recognitionMode')">
                  <el-radio-group v-model="autoDetectMode" size="small" class="slicing-mode-group">
                    <el-radio-button label="padding">{{ $t('sidebar.recognitionModes.padding') }}</el-radio-button>
                    <el-radio-button label="fixedSize">{{ $t('sidebar.recognitionModes.fixedSize') }}</el-radio-button>
                  </el-radio-group>
                </el-form-item>

                <el-form-item :label-width="labelWidth" :label="$t('sidebar.boxPadding')"
                  v-if="autoDetectMode === 'padding'">
                  <el-slider v-model="autoDetectPadding" :min="0" :max="20" :step="1" show-input size="small" />
                </el-form-item>

                <div v-if="autoDetectMode === 'fixedSize'">
                  <el-row :gutter="10">
                    <el-col :span="12">
                      <el-form-item :label="$t('sidebar.width')">
                        <el-input-number v-model="imageEditor.selectionWidth" :min="1" :max="2000" size="small"
                          style="width: 100%;" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="12">
                      <el-form-item :label="$t('sidebar.height')">
                        <el-input-number v-model="imageEditor.selectionHeight" :min="1" :max="2000" size="small"
                          style="width: 100%;" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                </div>
                <div class="action-buttons">
                  <el-button type="primary" style="width: 100%;" @click="handleAutoDetect">{{ $t('sidebar.autoDetect')
                  }}</el-button>
                  <el-button type="danger" style="width: 100%;" @click="handleClearAll">
                    <el-icon>
                      <Delete />
                    </el-icon>
                    {{ $t('sidebar.clearBoxes') }}
                  </el-button>
                </div>
              </div>

              <div v-if="slicingMode === 'grid'">
                <el-row :gutter="10">
                  <el-col :span="12">
                    <el-form-item :label="$t('sidebar.rows')">
                      <el-input-number v-model="gridRows" :min="1" :max="100" size="small" style="width: 100%" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item :label="$t('sidebar.cols')">
                      <el-input-number v-model="gridCols" :min="1" :max="100" size="small" style="width: 100%" />
                    </el-form-item>
                  </el-col>
                </el-row>
                <div class="action-buttons">
                  <el-button type="primary" style="width: 100%;" @click="fitGridToImage">{{ $t('sidebar.generateGrid')
                  }}</el-button>
                  <el-button type="danger" style="width: 100%;" @click="clearGrid"><el-icon>
                      <Delete />
                    </el-icon>{{ $t('sidebar.clearGrid') }}</el-button>
                </div>
              </div>

              <el-divider>{{ $t('sidebar.export') }}</el-divider>
              <el-row :gutter="10">
                <el-col :span="18">
                  <el-input v-model="exportPrefix" :placeholder="$t('sidebar.fileNamePrefix')">
                    <template #prepend>{{ $t('sidebar.prefix') }}</template>
                  </el-input>
                </el-col>
                <el-col :span="6">
                  <el-input v-model="exportConnector" :placeholder="$t('sidebar.connector')" />
                </el-col>
              </el-row>
              <el-text type="info" size="small" style="margin-top: 5px; display: block;">
                {{ $t('sidebar.fileNamePreview') }} {{ fileNamePreview }}
              </el-text>
              <el-button type="success" style="width: 100%; margin-top: 10px;" @click="handleExport">
                <el-icon>
                  <Download />
                </el-icon>
                {{ $t('sidebar.exportImages') }}
              </el-button>

              <el-divider v-if="slicingMode === 'custom'">{{ $t('sidebar.preview') }}</el-divider>
              <div class="preview-box checkerboard-bg" v-if="slicingMode === 'custom'">
                <canvas ref="previewCanvasRef"></canvas>
              </div>
            </div>
          </el-card>
        </el-aside>
        <el-main class="main-content">
          <el-card shadow="always" class="canvas-card">
            <canvas v-if="sourceImage" ref="canvasRef" class="editor-canvas checkerboard-bg" :style="{ cursor: cursorStyle }"
              @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseLeave"
              @contextmenu.prevent="onRightClick" @drop.prevent="onDrop" @dragover.prevent></canvas>
            <div v-if="isMenuVisible"
              :style="{ top: menuTop + 'px', left: menuLeft + 'px', position: 'fixed', zIndex: 9999 }">
              <el-dropdown ref="dropdownRef" @command="handleCommand" @visible-change="handleVisibleChange">
                <span class="el-dropdown-link"></span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="'sendToBack'">{{ $t('contextMenu.sendToBack') }}</el-dropdown-item>
                    <el-dropdown-item :command="'deleteBox'" divided class="context-menu-item-danger">{{
                      $t('contextMenu.deleteBox') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <el-upload v-if="!sourceImage" class="canvas-placeholder" drag action="#" :show-file-list="false"
              :auto-upload="false" @change="handleFileChange" @drop.prevent @dragover.prevent>
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text" v-html="$t('upload.main')"></div>
            </el-upload>
          </el-card>
        </el-main>
      </el-container>
      <el-footer class="app-footer">
        <span>MIT License © 2025 AskTao | <span>Image Splitter v{{ version }}</span></span>
        <a href="https://github.com/ask-tao/image-splitter" target="_blank" rel="noopener noreferrer"
          class="github-link footer-github-icon">
          <svg viewBox="0 0 1024 1024" width="24" height="24" fill="currentColor" v-html="githubSvgPath"></svg>
        </a>
      </el-footer>
    </el-container>
    <el-dialog v-model="helpDialogVisible" :title="$t('helpDialog.title')" width="60%">
      <div class="help-content">
        <ul>
          <li v-for="(feature, index) in helpFeatures" :key="index">
            <span v-html="feature.title"></span>
            <ul v-if="feature.items">
              <li v-for="(item, itemIndex) in feature.items" :key="itemIndex" v-html="item"></li>
            </ul>
          </li>
        </ul>
      </div>
    </el-dialog>
    <el-dialog v-model="aboutDialogVisible" :title="$t('aboutDialog.title')" width="400px">
      <div class="about-content">
        <p>{{ $t('aboutDialog.description') }}</p>
        <p>{{ $t('aboutDialog.purpose') }}</p>
        <p>{{ $t('aboutDialog.developer') }}: AskTao</p>
        <p>{{ $t('aboutDialog.version') }}: {{ version }}</p>
        <p>{{ $t('aboutDialog.github') }}: <a href="https://github.com/ask-tao/image-splitter" target="_blank">https://github.com/ask-tao/image-splitter</a></p>
        <el-divider />
        <div class="donation-container">
          <p>{{ $t('aboutDialog.donation') }}</p>
          <img src="https://cdn.jsdelivr.net/gh/ask-tao/wechat-public-img/images/微信图片_2025-08-22_140048_725.jpg" alt="WeChat Pay" class="donation-image-placeholder" />
          <p>{{ $t('aboutDialog.motto') }}</p>
        </div>
      </div>
    </el-dialog>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElNotification, ElMessageBox } from 'element-plus';
import { UploadFilled, Download, Delete, Sunny, Moon, QuestionFilled, InfoFilled } from '@element-plus/icons-vue';
import enLocale from 'element-plus/dist/locale/en.mjs';
import zhCnLocale from 'element-plus/dist/locale/zh-cn.mjs';
import pkg from '../package.json';
import { useImageEditor } from './composables/useImageEditor';
import { useTheme } from './composables/useTheme';

const { t, locale, tm } = useI18n();

onMounted(() => {
  // --- IPC Listeners ---
  window.ipcApi?.onUpdateNotAvailable(() => {
    ElNotification({
      title: t('updater.checkUpdate'),
      message: t('updater.updateNotAvailable'),
      type: 'info',
    });
  });

  window.ipcApi?.onUpdateDownloaded((info) => {
    ElMessageBox.confirm(
      t('updater.downloadedMsg'),
      t('updater.downloadedTitle'),
      {
        confirmButtonText: t('updater.updateNow'),
        cancelButtonText: t('updater.later'),
        type: 'success',
      }
    ).then(() => {
      // TODO: Add IPC call to main process to quit and install the update
    });
  });

  window.ipcApi?.onUpdateError((error) => {
    ElNotification({
      title: t('updater.errorTitle'),
      message: t('updater.errorMsg'),
      type: 'error',
    });
  });

  window.ipcApi?.onShowHelpDialog(() => {
    helpDialogVisible.value = true;
  });

  window.ipcApi?.onShowAboutDialog(() => {
    aboutDialogVisible.value = true;
  });

  // Listen for language change requests from the main process menu
  window.ipcApi?.onSetLanguage((lang) => {
    handleLanguageChange(lang);
  });

  // --- Initial State Sync ---
  // Send initial language to the main process so it can build the menu correctly
  window.ipcApi?.sendLanguageChange(locale.value);
});

const githubSvgPath = `<path d="M512 0C229.25 0 0 229.25 0 512a512.2 512.2 0 0 0 351.22 488.22c25.5 4.72 34.8-11.05 34.8-24.52v-86.42c-153.4 33.3-185.88-73.82-185.88-73.82-23.2-58.92-56.65-74.6-56.65-74.6-46.3-31.65 3.5-31 3.5-31 51.2 3.62 78.2 52.58 78.2 52.58 45.48 77.92 119.22 55.42 148.22 42.42a107.36 107.36 0 0 1 32.4-65.82c-113.1-12.8-231.9-56.55-231.9-251.5a196.3 196.3 0 0 1 52.6-137.32 184.18 184.18 0 0 1 5-135.5s42.7-13.68 140 52.2a485.32 485.32 0 0 1 255 0c97.3-65.88 140-52.2 140-52.2a184.18 184.18 0 0 1 5 135.5 196.3 196.3 0 0 1 52.6 137.32c0 195.4-119.1 238.5-232.4 251.1a123.32 123.32 0 0 1 34.6 94.92v140.32c0 13.6 9.2 29.4 35 24.5A512.2 512.2 0 0 0 1024 512C1024 229.25 794.75 0 512 0z"></path>`;

const version = pkg.version;
const { isDarkMode } = useTheme();

const helpDialogVisible = ref(false);
const aboutDialogVisible = ref(false);

const helpFeatures = computed(() => tm('helpDialog.content.featuresList'));

const labelWidth = computed(() => (locale.value === 'zh-CN' ? '80px' : '110px'));

const currentLocale = computed(() => {
  return locale.value === 'zh-CN' ? zhCnLocale : enLocale;
});

const handleLanguageChange = (lang: string) => {
  if (lang) {
    locale.value = lang;
    localStorage.setItem('lang', lang);
    // Notify the main process of the language change
    window.ipcApi?.sendLanguageChange(lang);
  }
};

const {
  canvasRef,
  previewCanvasRef,
  sourceImage,
  cursorStyle,
  slicingMode,
  gridRows,
  gridCols,
  canvasZoom,
  canvasPadding,
  autoDetectPadding,
  exportPrefix,
  exportConnector,
  fileNamePreview,
  isMenuVisible,
  menuTop,
  menuLeft,
  dropdownRef,
  handleFileChange,
  onDrop,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onRightClick,
  handleCommand,
  handleVisibleChange,
  fitGridToImage,
  clearGrid,
  handleAutoDetect,
  handleClearAll,
  handleExport,
  imageEditor,
  autoDetectMode,
} = useImageEditor();
</script>

<style>
html,
body,
#app,
.app-container {
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: var(--el-bg-color);
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--el-color-primary);
  border-bottom: 1px solid var(--el-color-primary-light-3);
  padding: 0 20px;
  height: 55px;
}

html:not(.dark) .app-header {
  background-color: #24292e;
  border-bottom: 1px solid #24292e;
}

html:not(.dark) .app-header h1,
html:not(.dark) .app-header .header-action-icon,
html:not(.dark) .app-header .github-link {
  color: white;
}



html:not(.dark) .app-header .header-action-icon:hover,
html:not(.dark) .app-header .github-link:hover {
  color: #f0f0f0;
}

.dark .app-header {
  background-color: #141414;
  border-bottom: 1px solid #303030;
}

.app-header h1 {
  margin: 0;
  font-size: 20px;
  white-space: nowrap;
  font-family: 'Roboto Slab', serif;
  font-weight: 700;
  background: linear-gradient(to bottom right, #41D1FF, #BD34FE);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header-title-group {
  display: flex;
  align-items: center;
  overflow: hidden;
}

.header-title-link {
  text-decoration: none;
  color: inherit;
}

.header-logo {
  height: 30px;
  margin-right: 10px;
}

.version-tag {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-left: 8px;
  font-weight: normal;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-action-icon {
  color: var(--el-color-white);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.header-action-icon:hover {
  color: var(--el-color-primary-light-7);
}

.github-link {
  color: var(--el-color-white);
  text-decoration: none;
  display: flex;
  align-items: center;
}

.github-link:hover {
  color: var(--el-color-primary-light-7);
}

.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 20px;
  color: white;
}

.footer-github-icon {
  margin-left: 10px;
  color: white;
}

html:not(.dark) .app-footer {
  background-color: #24292e;
  border-top: 1px solid #24292e;
}

.dark .app-footer {
  background-color: #141414;
  border-top: 1px solid #303030;
}

.dark .el-divider__text {
  background-color: var(--el-bg-color-overlay);
}

.dark .checkerboard-bg {
  background-image:
    linear-gradient(45deg, #3e3e3e 25%, transparent 25%),
    linear-gradient(135deg, #3e3e3e 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #3e3e3e 75%),
    linear-gradient(135deg, transparent 75%, #3e3e3e 75%);
}

.main-content {
  padding: 10px;
  flex: 1;
  min-height: 0;
  min-width:350px;
}

.content-container {
  flex: 1;
}

.canvas-card {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0 !important;
  box-sizing: border-box;
}

.canvas-card>.el-card__body {
  width: 100%;
  height: 100%;
  display: flex;
  box-sizing: border-box;
  overflow: auto;
}

.canvas-card>.el-card__body::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.canvas-card>.el-card__body::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.canvas-card>.el-card__body::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 5px;
}

.canvas-card>.el-card__body::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.canvas-placeholder {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  bottom: 20px;
}

.canvas-placeholder .el-upload-dragger {
    width: 100%;
    height: 792.5px; /** 100%不生效，估计是组件内部约束，只能写死 */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.canvas-placeholder .el-icon--upload {
  margin: 0;
}

.editor-canvas {
  border: 1px dashed var(--el-border-color);
  flex-shrink: 0;
  flex-grow: 0;
  margin: auto;
}

.sidebar {
  padding: 10px 0 10px 10px;
}

.control-panel .el-divider__text {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.control-panel .el-form-item {
  margin-bottom: 5px;
}

.padding-input {
  width: 100px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  margin-bottom: 10px;
}

.preview-box {
  width: 100%;
  height: 200px;
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  box-sizing: border-box;
}

.preview-box canvas {
  max-width: 100%;
  max-height: 100%;
}

.upload-control {
  margin-bottom: 20px;
}

.upload-control .el-upload-dragger {
  height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-control .el-icon--upload {
  margin: 0;
}

.sidebar .el-icon--upload {
  color: #C0C4CC;
}

.checkerboard-bg {
  background-image:
    linear-gradient(45deg, #eee 25%, transparent 25%),
    linear-gradient(135deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%),
    linear-gradient(135deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  background-position: 0 0, 10px 0, 10px -10px, 0px 10px;
}

.context-menu-item-danger.el-dropdown-menu__item:hover {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.slicing-mode-group {
  display: flex;
  flex: 1;
}

.slicing-mode-group .el-radio-button {
  flex: 1;
}

.slicing-mode-group .el-radio-button .el-radio-button__inner {
  width: 100%;
  text-align: center;
}

.help-content h3 {
  margin-top: 0;
}

.help-content ul {
  padding-left: 20px;
}

.help-content li {
  margin-bottom: 10px;
}

.help-content code {
  background-color: var(--el-color-info-light-9);
  padding: 2px 4px;
  border-radius: 4px;
  color: var(--el-color-danger);
}

.about-content {
  text-align: center;
}

.about-content p {
  margin-bottom: 10px;
}

.donation-container {
  margin-top: 20px;
}

.donation-image-placeholder {
  width: 150px;
  height: 150px;
  display: block;
  margin: 10px auto;
  line-height: 150px;
  color: var(--el-text-color-secondary);
  text-align: center;
  content: "赞赏码占位图";
  font-size: 14px;
}
</style>