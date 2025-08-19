import JSZip from 'jszip';

export interface Box {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class ImageEditorState {
  sourceImage: HTMLImageElement | null = null;
  boxes: Box[] = [];
  gridArea: Box | null = null;
  gridRows: number = 2;
  gridCols: number = 2;
  selectionWidth: number | undefined = undefined;
  selectionHeight: number | undefined = undefined;

  private t: (key: string) => string;

  constructor(t: (key: string) => string) {
    this.t = t;
  }

  async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        this.sourceImage = img;
        this.boxes = [];
        this.gridArea = null;
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
    });
  }

  addBox(box: Omit<Box, 'id'>): Box {
    const newBox = { ...box, id: Date.now() };
    this.boxes.push(newBox);
    return newBox;
  }

  deleteBox(boxId: number) {
    const index = this.boxes.findIndex(b => b.id === boxId);
    if (index !== -1) {
      this.boxes.splice(index, 1);
    }
  }

  clearBoxes() {
    this.boxes = [];
  }

  setGrid(rows: number, cols: number) {
    this.gridRows = rows;
    this.gridCols = cols;
  }

  fitGridToImage(padding: number) {
    if (!this.sourceImage) return;
    this.gridArea = {
      id: Date.now(),
      x: padding,
      y: padding,
      w: this.sourceImage.width,
      h: this.sourceImage.height,
    };
  }

  clearGrid() {
    this.gridArea = null;
  }

  autoDetect(imageData: ImageData, padding: number, canvasPadding: number, shouldSetFixedSize?: boolean): Box[] {
    const { data, width, height } = imageData;
    const visited = new Uint8Array(width * height);
    const newBoxes: Box[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x);
        if (visited[index] || data[index * 4 + 3] === 0) continue;

        const queue: [number, number][] = [[x, y]];
        visited[index] = 1;
        let minX = x, minY = y, maxX = x, maxY = y;

        while (queue.length > 0) {
          const [curX, curY] = queue.shift()!;
          minX = Math.min(minX, curX); minY = Math.min(minY, curY);
          maxX = Math.max(maxX, curX); maxY = Math.max(maxY, curY);
          const neighbors = [[curX, curY - 1], [curX, curY + 1], [curX - 1, curY], [curX + 1, curY]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIndex = (ny * width + nx);
              if (!visited[neighborIndex] && data[neighborIndex * 4 + 3] > 0) {
                visited[neighborIndex] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }

        let boxW = (maxX - minX + 1) + padding * 2;
        let boxH = (maxY - minY + 1) + padding * 2;

        if (shouldSetFixedSize && (this.selectionWidth == null || this.selectionHeight == null)) {
          this.selectionWidth = boxW;
          this.selectionHeight = boxH;
        }

        if (this.selectionWidth != null && this.selectionHeight != null) {
          boxW = this.selectionWidth;
          boxH = this.selectionHeight;
        }

        newBoxes.push({
          id: Date.now() + newBoxes.length,
          x: minX - padding + canvasPadding,
          y: minY - padding + canvasPadding,
          w: boxW,
          h: boxH
        });
      }
    }
    this.boxes = newBoxes;
    return newBoxes;
  }

  async export(prefix: string, connector: string, slicingMode: 'custom' | 'grid', canvasPadding: number): Promise<Blob> {
    if (!this.sourceImage) {
      throw new Error(this.t('errors.noSource'));
    }

    let boxesToExport: Box[] = [];
    if (slicingMode === 'custom') {
      if (this.boxes.length === 0) throw new Error(this.t('errors.noBoxes'));
      boxesToExport = this.boxes;
    } else if (slicingMode === 'grid') {
      if (!this.gridArea) throw new Error(this.t('errors.noGrid'));
      const { x, y, w, h } = this.gridArea;
      const cellWidth = w / this.gridCols;
      const cellHeight = h / this.gridRows;
      for (let i = 0; i < this.gridRows; i++) {
        for (let j = 0; j < this.gridCols; j++) {
          boxesToExport.push({
            id: i * this.gridCols + j,
            x: x + j * cellWidth,
            y: y + i * cellHeight,
            w: cellWidth,
            h: cellHeight,
          });
        }
      }
    }

    if (boxesToExport.length === 0) {
      throw new Error(this.t('errors.noContent'));
    }

    const zip = new JSZip();
    const img = this.sourceImage;

    for (const [index, box] of boxesToExport.entries()) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = box.w;
      tempCanvas.height = box.h;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) continue;

      const imageRect = { x: canvasPadding, y: canvasPadding, w: img.width, h: img.height };
      const intersectX = Math.max(box.x, imageRect.x);
      const intersectY = Math.max(box.y, imageRect.y);
      const intersectMaxX = Math.min(box.x + box.w, imageRect.x + imageRect.w);
      const intersectMaxY = Math.min(box.y + box.h, imageRect.y + imageRect.h);
      const intersectW = intersectMaxX - intersectX;
      const intersectH = intersectMaxY - intersectY;

      if (intersectW > 0 && intersectH > 0) {
        const sourceX = intersectX - canvasPadding;
        const sourceY = intersectY - canvasPadding;
        const destX = intersectX - box.x;
        const destY = intersectY - box.y;
        tempCtx.drawImage(img, sourceX, sourceY, intersectW, intersectH, destX, destY, intersectW, intersectH);
      }

      const blob = await new Promise<Blob | null>(resolve => tempCanvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const filename = `${prefix}${connector}${index + 1}.png`;
        zip.file(filename, blob);
      }
    }

    return zip.generateAsync({ type: 'blob' });
  }
}