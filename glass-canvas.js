export function connectGlassCanvas(scene, canvas) {
  const device = scene.gpuDevice;
  let texture;
  let width = 0;
  let height = 0;
  let revision = 1;
  let uploaded = 0;
  const changed = () => {
    revision += 1;
    scene.requestRender();
  };
  const source = {
    gpuDevice: device,
    sceneId: -1000000,
    paint() {
      const viewport = canvas.getBoundingClientRect();
      if (!canvas.width || !canvas.height || !viewport.width || !viewport.height) return null;
      if (width !== canvas.width || height !== canvas.height) {
        texture?.destroy();
        width = canvas.width;
        height = canvas.height;
        texture = device.createTexture({
          size: [width, height],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        uploaded = 0;
      }
      if (uploaded !== revision) {
        device.queue.copyExternalImageToTexture({ source: canvas }, { texture }, [width, height]);
        uploaded = revision;
      }
      return { owner: source, texture, width, height, capacityWidth: width, capacityHeight: height, revision, viewport };
    },
    dispose() {
      canvas.removeEventListener('hero-fluid-frame', changed);
      texture?.destroy();
    },
  };
  canvas.addEventListener('hero-fluid-frame', changed);
  return scene.addPaintSource(canvas, source);
}
