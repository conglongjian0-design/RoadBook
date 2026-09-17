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
          ctx.fillStyle = '#eef0e5';
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = '#e0e5d4';
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
          const lines = project(this.data.segments, width, height, 24);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          lines.forEach((ps) => {
            if (!ps.length) return;
            ctx.beginPath();
            ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 7;
            ctx.stroke();
            ctx.strokeStyle = '#64794b';
            ctx.lineWidth = 3;
            ctx.stroke();
          });
          const all = lines.flat();
          if (all.length) {
            [all[0], all[all.length - 1]].forEach((p, i) => {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
              ctx.fillStyle = i ? '#cd834d' : '#334d2c';
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 2;
              ctx.stroke();
            });
          }
        });
    },
  },
});
