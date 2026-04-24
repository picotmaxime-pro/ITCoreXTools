import { BrowserWindow } from 'electron';

export interface WebGLBenchmarkResult {
  averageFps: number;
  minFps: number;
  maxFps: number;
  frameCount: number;
  score: number; // Score calculé basé sur FPS et complexité
  testDuration: number;
  gpuInfo: {
    renderer: string;
    vendor: string;
    maxTextureSize: number;
    maxViewportDims: number;
  };
}

export class GPUWebGLBenchmark {
  private window: BrowserWindow | null = null;
  private isRunning = false;

  async run(duration: number = 30): Promise<WebGLBenchmarkResult> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        reject(new Error('Benchmark already running'));
        return;
      }

      this.isRunning = true;

      // Créer une fenêtre cachée (pas offscreen pour avoir accès au GPU)
      this.window = new BrowserWindow({
        width: 1920,
        height: 1080,
        show: false, // Fenêtre cachée mais avec accès GPU
        skipTaskbar: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          offscreen: false, // Désactivé pour permettre WebGL accéléré
        },
      });
      
      // Masquer la fenêtre immédiatement après création
      this.window.setMenu(null);
      this.window.hide();

      // HTML avec benchmark WebGL
      const benchmarkHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>GPU Benchmark</title>
          <style>
            body { margin: 0; overflow: hidden; background: #000; }
            canvas { display: block; width: 100vw; height: 100vh; }
            #info {
              position: fixed;
              top: 10px;
              left: 10px;
              color: #0f0;
              font-family: monospace;
              font-size: 14px;
              z-index: 100;
            }
          </style>
        </head>
        <body>
          <div id="info">FPS: <span id="fps">0</span> | Frame: <span id="frame">0</span></div>
          <canvas id="glCanvas"></canvas>
          <script>
            const canvas = document.getElementById('glCanvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            
            if (!gl) {
              console.error('WebGL not supported');
              window.webglResult = { error: 'WebGL not supported' };
              return;
            }

            // Get GPU info
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const gpuInfo = debugInfo ? {
              renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
              vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
            } : {
              renderer: 'Unknown',
              vendor: 'Unknown',
            };
            gpuInfo.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            gpuInfo.maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);

            // Resize canvas
            canvas.width = 1920;
            canvas.height = 1080;
            gl.viewport(0, 0, canvas.width, canvas.height);

            // Vertex shader
            const vertexShaderSource = \`
              attribute vec2 position;
              void main() {
                gl_Position = vec4(position, 0.0, 1.0);
              }
            \`;

            // Complex fragment shader with ray marching
            const fragmentShaderSource = \`
              precision highp float;
              uniform float time;
              uniform vec2 resolution;
              
              // Noise function
              float hash(vec3 p) {
                p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                         dot(p, vec3(269.5, 183.3, 246.1)),
                         dot(p, vec3(113.5, 271.9, 124.6)));
                return fract(sin(dot(p, vec3(1.0))) * 43758.5453);
              }
              
              // 3D noise
              float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                
                float n = mix(
                  mix(
                    mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                    mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x),
                    f.y
                  ),
                  mix(
                    mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                    mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x),
                    f.y
                  ),
                  f.z
                );
                return n;
              }
              
              // Fractal Brownian Motion
              float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;
                float frequency = 1.0;
                for (int i = 0; i < 6; i++) {
                  value += amplitude * noise(p * frequency);
                  amplitude *= 0.5;
                  frequency *= 2.0;
                }
                return value;
              }
              
              // Sphere SDF
              float sphere(vec3 p, float r) {
                return length(p) - r;
              }
              
              // Scene SDF
              float map(vec3 p) {
                float d = sphere(p + vec3(sin(time) * 2.0, 0.0, 0.0), 1.0);
                d = min(d, sphere(p + vec3(0.0, cos(time * 0.7) * 2.0, 0.0), 0.8));
                d = min(d, sphere(p + vec3(0.0, 0.0, sin(time * 0.5) * 2.0), 0.6));
                
                // Add displacement
                float displacement = fbm(p * 2.0 + time * 0.5) * 0.3;
                d += displacement;
                
                return d;
              }
              
              // Ray marching
              float rayMarch(vec3 ro, vec3 rd) {
                float t = 0.0;
                for (int i = 0; i < 100; i++) {
                  vec3 p = ro + rd * t;
                  float d = map(p);
                  if (d < 0.001 || t > 50.0) break;
                  t += d * 0.5;
                }
                return t;
              }
              
              // Normal calculation
              vec3 getNormal(vec3 p) {
                float d = map(p);
                vec2 e = vec2(0.001, 0.0);
                return normalize(vec3(
                  map(p + e.xyy) - d,
                  map(p + e.yxy) - d,
                  map(p + e.yyx) - d
                ));
              }
              
              void main() {
                vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / resolution.y;
                
                vec3 ro = vec3(0.0, 0.0, 5.0);
                vec3 rd = normalize(vec3(uv, -1.0));
                
                // Rotate camera
                float camAngle = time * 0.3;
                rd.xz *= mat2(cos(camAngle), -sin(camAngle), sin(camAngle), cos(camAngle));
                
                float t = rayMarch(ro, rd);
                vec3 p = ro + rd * t;
                
                vec3 color = vec3(0.0);
                
                if (t < 50.0) {
                  vec3 n = getNormal(p);
                  vec3 lightDir = normalize(vec3(1.0, 1.0, -1.0));
                  float diff = max(dot(n, lightDir), 0.0);
                  float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);
                  
                  // Procedural texture
                  float tex = fbm(p * 3.0);
                  
                  color = vec3(0.2, 0.5, 0.8) * (diff + 0.2) + vec3(spec);
                  color *= (0.8 + tex * 0.4);
                  
                  // Fog
                  float fog = 1.0 - exp(-t * 0.05);
                  color = mix(color, vec3(0.1, 0.1, 0.15), fog);
                } else {
                  // Background gradient
                  color = vec3(0.1, 0.1, 0.15) + uv.y * 0.1;
                }
                
                gl_FragColor = vec4(color, 1.0);
              }
            \`;

            // Compile shader
            function compileShader(gl, source, type) {
              const shader = gl.createShader(type);
              gl.shaderSource(shader, source);
              gl.compileShader(shader);
              if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error('Shader compile error:', gl.getShaderInfoLog(shader));
                return null;
              }
              return shader;
            }

            const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
            const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

            if (!vertexShader || !fragmentShader) {
              window.webglResult = { error: 'Shader compilation failed' };
              return;
            }

            // Create program
            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
              console.error('Program link error:', gl.getProgramInfoLog(program));
              window.webglResult = { error: 'Program linking failed' };
              return;
            }

            gl.useProgram(program);

            // Create buffer
            const positions = new Float32Array([
              -1, -1,
               1, -1,
              -1,  1,
              -1,  1,
               1, -1,
               1,  1,
            ]);

            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

            const positionLocation = gl.getAttribLocation(program, 'position');
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            // Get uniform locations
            const timeLocation = gl.getUniformLocation(program, 'time');
            const resolutionLocation = gl.getUniformLocation(program, 'resolution');

            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

            // Benchmark variables
            let frameCount = 0;
            let lastTime = performance.now();
            let fpsSum = 0;
            let fpsMin = 9999;
            let fpsMax = 0;
            const fpsHistory = [];
            const startTime = performance.now();

            function render() {
              const now = performance.now();
              const elapsed = (now - startTime) / 1000;
              
              // Calculate FPS
              const delta = now - lastTime;
              const fps = 1000 / delta;
              lastTime = now;
              
              fpsHistory.push(fps);
              fpsSum += fps;
              fpsMin = Math.min(fpsMin, fps);
              fpsMax = Math.max(fpsMax, fps);
              frameCount++;
              
              // Update display
              if (frameCount % 10 === 0) {
                document.getElementById('fps').textContent = fps.toFixed(1);
                document.getElementById('frame').textContent = frameCount;
              }

              // Render
              gl.uniform1f(timeLocation, elapsed);
              gl.drawArrays(gl.TRIANGLES, 0, 6);

              // Continue or finish
              if (elapsed < ${duration}) {
                requestAnimationFrame(render);
              } else {
                // Calculate final results
                const avgFps = fpsSum / frameCount;
                const recentFps = fpsHistory.slice(-60); // Last 60 frames
                const recentAvg = recentFps.reduce((a, b) => a + b, 0) / recentFps.length;
                
                // Score: weighted average of overall and recent FPS
                // Complex shader multiplier: 50 (ray marching + noise + lighting)
                const score = Math.round((avgFps * 0.3 + recentAvg * 0.7) * 50);
                
                window.webglResult = {
                  averageFps: Math.round(avgFps * 10) / 10,
                  minFps: Math.round(fpsMin * 10) / 10,
                  maxFps: Math.round(fpsMax * 10) / 10,
                  frameCount: frameCount,
                  score: score,
                  testDuration: elapsed,
                  gpuInfo: gpuInfo,
                };
                
                console.log('WebGL Benchmark Complete:', window.webglResult);
              }
            }

            // Start benchmark
            requestAnimationFrame(render);
          </script>
        </body>
        </html>
      `;

      // Load the HTML content
      this.window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(benchmarkHTML));

      // Wait for benchmark to complete
      const checkInterval = setInterval(() => {
        if (!this.window || this.window.isDestroyed()) {
          clearInterval(checkInterval);
          reject(new Error('Window destroyed'));
          return;
        }

        this.window.webContents.executeJavaScript('window.webglResult').then((result) => {
          if (result) {
            clearInterval(checkInterval);
            this.cleanup();
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result as WebGLBenchmarkResult);
            }
          }
        }).catch(() => {
          // Ignore errors during execution
        });
      }, 500);

      // Timeout after duration + 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        this.cleanup();
        reject(new Error('Benchmark timeout'));
      }, (duration + 5) * 1000);
    });
  }

  stop(): void {
    this.isRunning = false;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
    this.window = null;
    this.isRunning = false;
  }
}
