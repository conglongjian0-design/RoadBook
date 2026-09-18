const { project } = require('../../lib/core');
Component({
  properties: { segments: { type: Array, value: [], observer: 'draw' } },
  lifetimes: {
    ready() {
      this.draw();
    },
  },
  methods: {
    draw() {
      this.createSelectorQuery()
        .select('#routeCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0] || !res[0].node) return;
          const { node: canvas, width, height } = res[0];
          if (!width || !height) return;
          const ctx = canvas.getContext('2d'),
            dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);
          ctx.fillStyle = '#0c100d';
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = '#202721';
          ctx.lineWidth = 1;
          for (let x = -height; x < width + height; x += 28) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + height * 0.45, height);
            ctx.stroke();
          }
          for (let y = 12; y < height; y += 28) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
          ctx.strokeStyle = '#161b17';
          ctx.lineWidth = 4;
          for (let y = 4; y < height; y += 58) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(width * 0.3, y + 20, width * 0.7, y - 18, width, y + 8);
            ctx.stroke();
          }
          const lines = project(this.data.segments, width, height, 24);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          lines.forEach((ps) => {
            if (!ps.length) return;
            ctx.beginPath();
            ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.strokeStyle = 'rgba(32,229,116,.20)';
            ctx.lineWidth = 13;
            ctx.stroke();
            ctx.strokeStyle = '#1ed760';
            ctx.lineWidth = 4;
            ctx.stroke();
          });
          const all = lines.flat();
          if (all.length) {
            [all[0], all[all.length - 1]].forEach((p, i) => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
              ctx.fillStyle = i ? '#f5f7f5' : '#1ed760';
              ctx.fill();
              ctx.strokeStyle = '#07110b';
              ctx.lineWidth = 2;
              ctx.stroke();
            });
          }
        });
    },
  },
});
