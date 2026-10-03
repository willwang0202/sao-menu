import type { BrowserFrame } from '../shared/surfaces';
import { pageBend } from '../shared/surfaces';
import { gpuProgram } from './webgl';
const vertex=`#version 300 es
precision highp float;
in vec2 aPoint;
out vec2 vUV;
void main(){
  vUV=aPoint;
  float n=aPoint.x*2.-1.;
  float inset=${pageBend.toFixed(2)}*(1.-n*n)*.5;
  float y=inset+aPoint.y*(1.-inset*2.);
  gl_Position=vec4(n,1.-y*2.,0.,1.);
}`;
const fragment=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uPage;
uniform sampler2D uChrome;
out vec4 color;
void main(){
  float y=vUV.y*700.;
  vec4 chrome=texture(uChrome,vUV);
  vec3 base=vec3(.97);
  if(y>=38. && y<678.)base=texture(uPage,vec2(vUV.x,(y-38.)/640.)).bgra.rgb;
  color=vec4(mix(base,chrome.rgb,chrome.a),1.);
  if(min(vUV.x,1.-vUV.x)*1000.<1.5 || min(vUV.y,1.-vUV.y)*700.<1.5)color=vec4(.898,.635,.208,1.);
}`;
/** A single GPU mesh replaces 2,000 CPU canvas strips and PNG decoding. */
export class CurvedBrowser {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly page: WebGLTexture;
  private readonly chrome: WebGLTexture;
  private vertices=0;
  private pageWidth=0; private pageHeight=0;
  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,depth:false,powerPreference:'high-performance'});
    if(!gl)throw new Error('WebGL2 is unavailable'); this.gl=gl;
    this.program=gpuProgram(gl,vertex,fragment);gl.useProgram(this.program);
    const points:number[]=[];
    for(let i=0;i<200;i++){const a=i/200,b=(i+1)/200;points.push(a,0,b,0,a,1,a,1,b,0,b,1);}
    this.vertices=points.length/2;this.buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
    const point=gl.getAttribLocation(this.program,'aPoint');gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
    this.page=this.texture(0);this.chrome=this.texture(1);
    gl.uniform1i(gl.getUniformLocation(this.program,'uPage'),0);gl.uniform1i(gl.getUniformLocation(this.program,'uChrome'),1);
    gl.clearColor(0,0,0,0);
  }
  private texture(unit:number):WebGLTexture {
    const gl=this.gl,texture=gl.createTexture()!;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));return texture;
  }
  updatePage(frame:BrowserFrame):void {
    if(frame.width<=0 || frame.height<=0 || frame.pixels.byteLength!==frame.width*frame.height*4)throw new Error('Invalid browser bitmap');
    const gl=this.gl;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.page);
    if(frame.width!==this.pageWidth || frame.height!==this.pageHeight){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,frame.width,frame.height,0,gl.RGBA,gl.UNSIGNED_BYTE,frame.pixels);this.pageWidth=frame.width;this.pageHeight=frame.height;}
    else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,frame.width,frame.height,gl.RGBA,gl.UNSIGNED_BYTE,frame.pixels);
  }
  updateChrome(source:HTMLCanvasElement):void {const gl=this.gl;gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.chrome);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
  draw():void {
    const gl=this.gl,ratio=devicePixelRatio;
    const width=Math.max(1,Math.round(this.canvas.clientWidth*ratio)),height=Math.max(1,Math.round(this.canvas.clientHeight*ratio));
    if(this.canvas.width!==width || this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;gl.viewport(0,0,width,height);}
    gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.drawArrays(gl.TRIANGLES,0,this.vertices);
  }
  dispose():void {const gl=this.gl;gl.deleteBuffer(this.buffer);gl.deleteTexture(this.page);gl.deleteTexture(this.chrome);gl.deleteProgram(this.program);}
}
