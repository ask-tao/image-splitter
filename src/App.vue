<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <h1>智能图片分割工具</h1>
    </el-header>
    <el-container class="content-container">
      <el-aside width="350px" class="sidebar">
        <el-card shadow="always">
          <div class="control-panel">
            <el-upload class="upload-control" drag action="#" :show-file-list="false" :auto-upload="false"
              @change="handleFileChange">
              <el-icon class="el-icon--upload"><upload-filled /></el-icon>
              <div class="el-upload__text">
                将图片文件拖到此处，或<em>点击上传</em>
              </div>
            </el-upload>

            <el-divider>编辑</el-divider>
            <el-form-item label-width="80px" label="画布缩放">
              <el-slider v-model="canvasZoom" :min="10" :max="400" :step="10" show-input size="small" />
            </el-form-item>
            <el-form-item label-width="80px" label="画布边距">
              <el-slider v-model="canvasPadding" :min="0" :max="100" show-input size="small" />
            </el-form-item>
            <el-form-item label-width="80px" label="切割模式">
              <el-radio-group v-model="slicingMode" size="small" class="slicing-mode-group">
                <el-radio-button label="custom">框选</el-radio-button>
                <el-radio-button label="grid">网格</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <div v-if="slicingMode === 'custom'">
              <el-form-item label-width="auto" label="选框边距">
                <el-slider v-model="autoDetectPadding" :min="0" :max="20" :step="1" show-input size="small" />
              </el-form-item>
              <div class="action-buttons">
                <el-button type="primary" style="width: 100%;" @click="handleAutoDetect">自动识别</el-button>
                <el-button type="danger" style="width: 100%;" @click="handleClearAll">
                  <el-icon>
                    <Delete />
                  </el-icon>
                  清除选框
                </el-button>
              </div>
            </div>

            <div v-if="slicingMode === 'grid'">
              <el-row :gutter="10">
                <el-col :span="12">
                  <el-form-item label="行数">
                    <el-input-number v-model="gridRows" :min="1" :max="100" size="small" style="width: 100%" />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="列数">
                    <el-input-number v-model="gridCols" :min="1" :max="100" size="small" style="width: 100%" />
                  </el-form-item>
                </el-col>
              </el-row>
              <div class="action-buttons">
                <el-button type="primary" style="width: 100%;" @click="fitGridToImage">生成网格</el-button>
                <el-button type="danger" style="width: 100%;" @click="clearGrid"><el-icon>
                    <Delete />
                  </el-icon>清除网格</el-button>
              </div>
            </div>

            <el-divider>导出</el-divider>
            <el-row :gutter="10">
              <el-col :span="18">
                <el-input v-model="exportPrefix" placeholder="请输入文件名前缀">
                  <template #prepend>前缀</template>
                </el-input>
              </el-col>
              <el-col :span="6">
                <el-input v-model="exportConnector" placeholder="连接符" />
              </el-col>
            </el-row>
            <el-text type="info" size="small" style="margin-top: 5px; display: block;">
              预览: {{ fileNamePreview }}
            </el-text>
            <el-button type="success" style="width: 100%; margin-top: 10px;" @click="handleExport">
              <el-icon>
                <Download />
              </el-icon>
              导出图片
            </el-button>

            <el-divider>预览</el-divider>
            <div class="preview-box checkerboard-bg">
              <canvas ref="previewCanvasRef"></canvas>
            </div>
          </div>
        </el-card>
      </el-aside>
      <el-main class="main-content">
        <el-card shadow="always" class="canvas-card">
          <canvas ref="canvasRef" class="editor-canvas checkerboard-bg" :style="{ cursor: cursorStyle }"
            @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseLeave"
            @contextmenu.prevent="onRightClick"></canvas>
          <div v-if="!sourceImage" class="canvas-placeholder" @drop.prevent="onDrop" @dragover.prevent
            @click="onCanvasPlaceholderClick">
            <input type="file" ref="fileInputRef" @change="onFileSelected" style="display: none" accept="image/*" />
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              将图片文件拖到此处，或<em>点击上传</em>
            </div>
          </div>
          <!-- Context Menu -->
          <div v-if="isMenuVisible"
            :style="{ top: menuTop + 'px', left: menuLeft + 'px', position: 'fixed', zIndex: 9999 }">
            <el-dropdown ref="dropdownRef" @command="handleCommand" @visible-change="handleVisibleChange">
              <span class="el-dropdown-link"></span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="sendToBack">层级置底</el-dropdown-item>
                  <el-dropdown-item command="deleteBox" divided class="context-menu-item-danger">删除选框</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-card>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { UploadFilled, Download, Delete } from '@element-plus/icons-vue';
import { useImageEditor } from './composables/useImageEditor';

const {
  canvasRef,
  previewCanvasRef,
  sourceImage,
  cursorStyle,
  fileInputRef,
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
  fitGridToImage,
  clearGrid,
  handleAutoDetect,
  handleClearAll,
  handleExport,
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
  background-color: #f4f4f5;
  display: flex;
  /* Enable flexbox */
  flex-direction: column;
  /* Stack children vertically */
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 10px;
}

.app-header h1 {
  margin: 0;
  font-size: 20px;
}

.main-content {
  padding: 10px;
  /* Removed display: flex, justify-content, align-items */
  flex: 1;
  /* Make it take available space */
  min-height: 0;
  min-width: min-content;
  /* Allow it to shrink if content is too big */
}

.content-container {
  flex: 1;
  /* Make it take remaining vertical space */
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

/* Custom scrollbar styling for WebKit browsers (Chrome, Safari on macOS) */
.canvas-card>.el-card__body::-webkit-scrollbar {
  width: 10px;
  /* Width of vertical scrollbar */
  height: 10px;
  /* Height of horizontal scrollbar */
}

.canvas-card>.el-card__body::-webkit-scrollbar-track {
  background: #f1f1f1;
  /* Track color */
}

.canvas-card>.el-card__body::-webkit-scrollbar-thumb {
  background: #888;
  /* Handle color */
  border-radius: 5px;
}

.canvas-card>.el-card__body::-webkit-scrollbar-thumb:hover {
  background: #555;
  /* Handle color on hover */
}

.canvas-placeholder {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #fff;
  z-index: 10;
  /* Ensure it's above canvas */
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
}

.canvas-placeholder:hover {
  border-color: #409EFF;
}

.canvas-placeholder .el-icon--upload {
  font-size: 67px;
  color: #C0C4CC;
  margin: 0;
}

.canvas-placeholder .el-upload__text {
  color: #606266;
  font-size: 14px;
}

.canvas-placeholder .el-upload__text em {
  color: #409EFF;
  font-style: normal;
}

.canvas-placeholder .el-upload-dragger {
  width: 100%;
  height: 100%;
}

.editor-canvas {
  border: 1px dashed #dcdfe6;
  flex-shrink: 0;
  /* Prevent shrinking */
  flex-grow: 0;
  /* Prevent growing */
  margin: auto;
}

.sidebar {
  padding: 10px 0 10px 10px;
}

.control-panel .el-divider__text {
  font-size: 14px;
  color: #909399;
}

.control-panel .el-form-item {
  margin-bottom: 5px;
}

.padding-input {
  width: 100px;
  /* Adjust width as needed */
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
  background-color: #fff;
  border: 1px solid #e4e7ed;
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
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, #eee 25%, transparent 25%),
    linear-gradient(135deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%),
    linear-gradient(135deg, transparent 75%, #eee 75%);
  background-size: 20px 20px;
  background-position: 0 0, 10px 0, 10px -10px, 0px 10px;
}

.context-menu-item-danger.el-dropdown-menu__item:hover {
  background-color: #fef0f0;
  color: #f56c6c;
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
</style>