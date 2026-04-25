import { BrowserWindow } from 'electron';

export interface WebGLBenchmarkResult {
  averageFps: number;
  minFps: number;
  maxFps: number;
  frameCount: number;
  score: number;
  testDuration: number;
  gpuInfo: {
    renderer: string;
    vendor: string;
    maxTextureSize: number;
    maxViewportDims: number[];
  };
  success: boolean;
  error?: string;
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

      // Créer une fenêtre visible pour montrer le benchmark GPU en action
      this.window = new BrowserWindow({
        width: 900,
        height: 700,
        show: true,
        title: 'GPU Benchmark - WebGL Test',
        alwaysOnTop: false,
        webPreferences: {
          contextIsolation: false, // Need this for window.webglResult
          nodeIntegration: false,
          offscreen: false,
          webSecurity: false,
        },
      });
      
      this.window.setMenu(null);

      // HTML avec benchmark WebGL robuste
      const benchmarkHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>GPU Benchmark</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              margin: 0; 
              overflow: hidden; 
              background: #000; 
              font-family: 'Segoe UI', monospace;
            }
            canvas { 
              display: block; 
              width: 100vw; 
              height: calc(100vh - 80px);
              margin-top: 80px;
            }
            #info {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              height: 80px;
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              color: #fff;
              font-family: 'Segoe UI', monospace;
              font-size: 14px;
              z-index: 100;
              padding: 10px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f3460;
            }
            #info h3 { 
              margin: 0; 
              color: #00d4ff; 
              font-size: 18px;
              text-shadow: 0 0 10px rgba(0,212,255,0.5);
            }
            .stats {
              display: flex;
              gap: 30px;
            }
            .stat {
              text-align: center;
            }
            .stat .label { 
              color: #888; 
              font-size: 11px;
              text-transform: uppercase;
            }
            .stat .value { 
              color: #00ff88; 
              font-weight: bold; 
              font-size: 20px;
              display: block;
              margin-top: 2px;
            }
            .stat .value.warning { color: #ffaa00; }
            .stat .value.error { color: #ff4444; }
            #error-display {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(255,0,0,0.9);
              color: white;
              padding: 20px;
              border-radius: 10px;
              font-size: 16px;
              display: none;
              z-index: 200;
              max-width: 80%;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div id="info">
            <div>
              <h3>GPU Benchmark Active</h3>
              <div style="color: #888; font-size: 12px; margin-top: 5px;">
                Ray marching + Particle systems + Heavy compute
              </div>
            </div>
            <div class="stats">
              <div class="stat">
                <span class="label">FPS</span>
                <span id="fps" class="value">0.0</span>
              </div>
              <div class="stat">
                <span class="label">Frames</span>
                <span id="frame" class="value">0</span>
              </div>
              <div class="stat">
                <span class="label">GPU</span>
                <span id="gpuName" class="value">...</span>
              </div>
              <div class="stat">
                <span class="label">Time</span>
                <span id="time" class="value">0s</span>
              </div>
            </div>
          </div>
          <div id="error-display"></div>
          <canvas id="glCanvas"></canvas>
          <script>
            function showError(msg) {
              document.getElementById('error-display').style.display = 'block';
              document.getElementById('error-display').textContent = msg;
              console.error('WebGL Error:', msg);
            }

            const canvas = document.getElementById('glCanvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('experimental-webgl') || canvas.getContext('webgl');
            
            if (!gl) {
              showError('WebGL not supported on this system');
              window.webglResult = { 
                success: false, 
                error: 'WebGL not supported',
                score: 0,
                averageFps: 0,
                minFps: 0,
                maxFps: 0,
                frameCount: 0,
                testDuration: 0,
                gpuInfo: { renderer: 'None', vendor: 'None', maxTextureSize: 0, maxViewportDims: [0, 0] }
              };
              return;
            }

            // Get GPU info
            let renderer = 'Unknown';
            let vendor = 'Unknown';
            try {
              const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
              if (debugInfo) {
                renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
                vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown';
              }
            } catch(e) {
              console.log('Could not get GPU debug info');
            }
            
            const gpuInfo = {
              renderer: renderer,
              vendor: vendor,
              maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0,
              maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [0, 0]
            };

            // Set canvas size
            canvas.width = 1024;
            canvas.height = 768;
            gl.viewport(0, 0, canvas.width, canvas.height);

            // Simple vertex shader
            const vertexShaderSource = \`
              attribute vec2 position;
              void main() {
                gl_Position = vec4(position, 0.0, 1.0);
              }
            \`;

            // Heavy fragment shader - Julia set with iterations
            const fragmentShaderSource = \`
              precision mediump float;
              uniform float time;
              uniform vec2 resolution;
              
              vec2 complexSqr(vec2 z) {
                return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
              }
              
              float julia(vec2 z, vec2 c) {
                for(int i = 0; i < 200; i++) {
                  if(dot(z, z) > 4.0) return float(i) / 200.0;
                  z = complexSqr(z) + c;
                }
                return 1.0;
              }
              
              float noise(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
              }
              
              void main() {
                vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / min(resolution.x, resolution.y);
                
                // Animated Julia set
                float t = time * 0.5;
                vec2 c = vec2(cos(t) * 0.8, sin(t * 0.7) * 0.6);
                
                // Multi-sampling for quality (and GPU load!)
                vec3 color = vec3(0.0);
                float samples = 4.0;
                
                for(float i = 0.0; i < samples; i++) {
                  vec2 offset = vec2(
                    cos(i * 1.57 + t) * 0.002,
                    sin(i * 1.57 + t) * 0.002
                  );
                  float iter = julia(uv + offset, c);
                  color += vec3(
                    iter * 0.5 + iter * sin(iter * 10.0 + t) * 0.3,
                    iter * 0.8 + iter * cos(iter * 8.0 - t) * 0.2,
                    iter + iter * sin(iter * 15.0) * 0.4
                  );
                }
                
                color /= samples;
                
                // Add noise for texture
                color += noise(uv * 1000.0 + time) * 0.02;
                
                gl_FragColor = vec4(color, 1.0);
              }
            \`;

            // Compile shaders
            function compileShader(source, type) {
              const shader = gl.createShader(type);
              gl.shaderSource(shader, source);
              gl.compileShader(shader);
              if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const error = gl.getShaderInfoLog(shader);
                showError('Shader compile failed: ' + error);
                return null;
              }
              return shader;
            }

            const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
            const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

            if (!vertexShader || !fragmentShader) {
              window.webglResult = { 
                success: false, 
                error: 'Shader compilation failed',
                score: 0,
                averageFps: 0,
                minFps: 0,
                maxFps: 0,
                frameCount: 0,
                testDuration: 0,
                gpuInfo: gpuInfo
              };
              return;
            }

            // Link program
            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
              showError('Program link failed: ' + gl.getProgramInfoLog(program));
              window.webglResult = { 
                success: false, 
                error: 'Program link failed',
                score: 0,
                averageFps: 0,
                minFps: 0,
                maxFps: 0,
                frameCount: 0,
                testDuration: 0,
                gpuInfo: gpuInfo
              };
              return;
            }

            gl.useProgram(program);

            // Create fullscreen quad
            const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            
            const positionLocation = gl.getAttribLocation(program, 'position');
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            // Get uniforms
            const timeLocation = gl.getUniformLocation(program, 'time');
            const resolutionLocation = gl.getUniformLocation(program, 'resolution');
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

            // Benchmark tracking
            let frameCount = 0;
            let lastTime = performance.now();
            let fpsSum = 0;
            let fpsMin = 999999;
            let fpsMax = 0;
            const fpsHistory = [];
            const startTime = performance.now();
            const testDuration = ${duration};

            function formatTime(seconds) {
              return Math.floor(seconds) + 's';
            }

            function updateDisplay(fps, elapsed) {
              document.getElementById('fps').textContent = fps.toFixed(1);
              document.getElementById('frame').textContent = frameCount;
              document.getElementById('gpuName').textContent = gpuInfo.renderer.substring(0, 20);
              document.getElementById('time').textContent = formatTime(elapsed);
              
              // Color code FPS
              const fpsEl = document.getElementById('fps');
              if (fps < 15) fpsEl.className = 'value error';
              else if (fps < 30) fpsEl.className = 'value warning';
              else fpsEl.className = 'value';
            }

            function render() {
              const now = performance.now();
              const elapsed = (now - startTime) / 1000;
              const delta = now - lastTime;
              lastTime = now;
              
              // Calculate FPS
              const fps = 1000.0 / Math.max(delta, 1);
              
              fpsHistory.push(fps);
              fpsSum += fps;
              fpsMin = Math.min(fpsMin, fps);
              fpsMax = Math.max(fpsMax, fps);
              frameCount++;
              
              // Update display every 5 frames
              if (frameCount % 5 === 0) {
                updateDisplay(fps, elapsed);
              }

              // Render heavy scene
              gl.uniform1f(timeLocation, elapsed);
              gl.drawArrays(gl.TRIANGLES, 0, 6);

              // Continue or finish
              if (elapsed < testDuration) {
                requestAnimationFrame(render);
              } else {
                // Calculate final score
                const avgFps = fpsSum / frameCount;
                const score = Math.round(avgFps * 100); // Score = FPS * 100
                
                window.webglResult = {
                  success: true,
                  averageFps: Math.round(avgFps * 10) / 10,
                  minFps: Math.round(fpsMin * 10) / 10,
                  maxFps: Math.round(fpsMax * 10) / 10,
                  frameCount: frameCount,
                  score: score,
                  testDuration: elapsed,
                  gpuInfo: gpuInfo
                };
                
                console.log('WebGL Benchmark Complete:', window.webglResult);
                document.getElementById('info').innerHTML = 
                  '<h3>GPU Benchmark Complete!</h3>' +
                  '<div style="color: #00ff88;">Score: ' + score + ' | Avg FPS: ' + avgFps.toFixed(1) + '</div>';
              }
            }

            // Start the benchmark
            document.getElementById('gpuName').textContent = gpuInfo.renderer.substring(0, 20);
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
          if (result && (result.success === true || result.success === false || result.error)) {
            clearInterval(checkInterval);
            this.cleanup();
            resolve(result as WebGLBenchmarkResult);
          }
        }).catch((err) => {
          // Wait for next check
        });
      }, 500);

      // Timeout after duration + 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        this.cleanup();
        resolve({
          success: false,
          error: 'Benchmark timeout',
          score: 0,
          averageFps: 0,
          minFps: 0,
          maxFps: 0,
          frameCount: 0,
          testDuration: 0,
          gpuInfo: { renderer: 'Unknown', vendor: 'Unknown', maxTextureSize: 0, maxViewportDims: [0, 0] }
        } as WebGLBenchmarkResult);
      }, (duration + 10) * 1000);
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
