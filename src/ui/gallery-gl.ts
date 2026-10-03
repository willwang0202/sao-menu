import type { GallerySettings } from '../shared/surfaces';
import { galleryTransitions } from '../shared/surface-layout';

const sources = new Map<string, Promise<string>>();
const vertex = 'attribute vec2 position; varying highp vec2 qt_TexCoord0; void main(){qt_TexCoord0=vec2((position.x+1.)*.5,(1.-position.y)*.5);gl_Position=vec4(position,0.,1.);}';
function fragment(source: string, fit: boolean): string {
  // Same sampling contract as the bundled media/qml/shared.js. The original
  // transition bodies and their author/license headers remain unchanged.
  const remap = fit ? 'max' : 'min';
  const transparent = fit ? 'if(uv.x<=0.||uv.x>=1.||uv.y<=0.||uv.y>=1.)return vec4(0.);' : '';
  return `precision mediump float;
varying highp vec2 qt_TexCoord0;
uniform sampler2D _fromS; uniform highp float _fromR;
uniform sampler2D _toS; uniform highp float _toR;
uniform lowp float progress; uniform highp float ratio;
const highp float PI=3.141592653589793;
vec2 remap(vec2 uv,float r){return .5+(uv-.5)*vec2(${remap}(ratio/r,1.),${remap}(r/ratio,1.));}
vec4 getFromColor(vec2 uv){uv=remap(uv,_fromR);${transparent}return texture2D(_fromS,uv);}
vec4 getToColor(vec2 uv){uv=remap(uv,_toR);${transparent}return texture2D(_toS,uv);}
${source}
void main(){gl_FragColor=transition(qt_TexCoord0);}`;
}

export class GalleryRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly buffer: WebGLBuffer;
  private readonly textures: WebGLTexture[];
  private readonly programs = new Map<string, WebGLProgram>();
  private program: WebGLProgram | null = null;
  private ratios = [1, 1];
  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('The gallery needs WebGL on this graphics driver.');
    this.gl = gl;
    this.buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.textures = [0, 1].map(unit => {
      const texture = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texture;
    });
  }
  async shader(name: string, fit: boolean): Promise<void> {
    if (!galleryTransitions.includes(name)) throw new Error('Unknown gallery transition.');
    const key = `${name}:${fit}`;
    let program = this.programs.get(key);
    if (!program) {
      if (!sources.has(name)) sources.set(name, fetch(`./sao-original/MediaShaders/${name}`).then(response => { if (!response.ok) throw new Error('Original gallery shader is unavailable.'); return response.text(); }));
      const source = await sources.get(name)!;
      const gl = this.gl;
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const reason = gl.getShaderInfoLog(shader); gl.deleteShader(shader); console.error(`Original transition ${name}: ${reason}`); throw new Error(`The ${name.replace('.glsl', '')} transition could not run on this graphics driver.`); }
        return shader;
      };
      const vertexShader = compile(gl.VERTEX_SHADER, vertex);
      let fragmentShader: WebGLShader;
      try { fragmentShader = compile(gl.FRAGMENT_SHADER, fragment(source, fit)); }
      catch (error) { gl.deleteShader(vertexShader); throw error; }
      program = gl.createProgram()!; gl.attachShader(program, vertexShader); gl.attachShader(program, fragmentShader); gl.linkProgram(program);
      gl.deleteShader(vertexShader); gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('The original gallery transition could not be linked.'); }
      this.programs.set(key, program);
    }
    this.program = program; this.canvas.dataset.shader = name;
  }
  images(from: HTMLImageElement | null, to: HTMLImageElement): void {
    const gl = this.gl;
    const maximum = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    [from, to].forEach((image, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, this.textures[unit]);
      if (!image) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); this.ratios[unit] = 1; return; }
      this.ratios[unit] = image.naturalWidth / image.naturalHeight;
      const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
      if (scale < 1) {
        const sample = document.createElement('canvas'); sample.width = Math.max(1, Math.floor(image.naturalWidth * scale)); sample.height = Math.max(1, Math.floor(image.naturalHeight * scale)); sample.getContext('2d')!.drawImage(image, 0, 0, sample.width, sample.height);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sample);
      } else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    });
  }
  draw(progress: number): void {
    if (!this.program) return;
    const gl = this.gl; const canvas = this.canvas;
    const scale = Math.min(2, devicePixelRatio);
    const width = Math.max(1, Math.round(canvas.clientWidth * scale)), height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height); gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const position = gl.getAttribLocation(this.program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(this.program, '_fromS'), 0); gl.uniform1i(gl.getUniformLocation(this.program, '_toS'), 1);
    gl.uniform1f(gl.getUniformLocation(this.program, '_fromR'), this.ratios[0]); gl.uniform1f(gl.getUniformLocation(this.program, '_toR'), this.ratios[1]);
    gl.uniform1f(gl.getUniformLocation(this.program, 'ratio'), width / height);
    gl.uniform1f(gl.getUniformLocation(this.program, 'progress'), Math.max(0, Math.min(1, progress)));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    canvas.dataset.status = 'ready';
  }
  destroy(): void {
    for (const program of this.programs.values()) this.gl.deleteProgram(program);
    for (const texture of this.textures) this.gl.deleteTexture(texture);
    this.gl.deleteBuffer(this.buffer);
  }
}
export function transitionName(settings: GallerySettings): string {
  return settings.transition === 'random' ? galleryTransitions[Math.floor(Math.random() * galleryTransitions.length)] : settings.transition;
}
