// Deliberately schematic demo routes: never claim these are field-verified tracks.
const fixtureData = [
  {
    id: 'demo-river',
    title: '沿着江风，慢慢骑',
    city: '上海',
    mode: 'cycling',
    description:
      '一段留给周末的滨江时光。把咖啡、江风和日落放进同一条路线。\n\n这是用于体验功能的示例轨迹，未经实地核验，请勿按示意线骑行。',
    coords: [
      [121.485, 31.245],
      [121.482, 31.239],
      [121.485, 31.231],
      [121.49, 31.223],
      [121.49, 31.215],
      [121.486, 31.207],
      [121.48, 31.2],
      [121.47, 31.194],
      [121.461, 31.188],
      [121.455, 31.181],
    ],
    names: ['外滩', '徐汇滨江'],
    theme: 'river',
  },
  {
    id: 'demo-lake',
    title: '绕湖一圈，把周末放慢',
    city: '杭州',
    mode: 'cycling',
    description:
      '绕过树影，找一处湖边歇脚。适合用来体验环线的展示与 GPX 导出。\n\n演示数据，路线仅作示意，不作为通行依据。',
    coords: [
      [120.148, 30.252],
      [120.139, 30.259],
      [120.126, 30.258],
      [120.115, 30.249],
      [120.115, 30.237],
      [120.126, 30.231],
      [120.141, 30.233],
      [120.15, 30.242],
      [120.148, 30.252],
    ],
    names: ['湖畔起点', '湖畔终点'],
    theme: 'lake',
  },
  {
    id: 'demo-walk',
    title: '走进老街的午后',
    city: '苏州',
    mode: 'walking',
    description:
      '从一条老街走到另一条巷子，沿途留些空白给偶遇的小店。\n\n演示数据，路线仅作示意，不作为通行依据。',
    coords: [
      [120.62, 31.316],
      [120.622, 31.313],
      [120.625, 31.313],
      [120.625, 31.308],
      [120.628, 31.308],
      [120.629, 31.303],
      [120.631, 31.3],
    ],
    names: ['老街入口', '河畔小巷'],
    theme: 'town',
  },
];
if (typeof module !== 'undefined') module.exports = fixtureData;
else window.fixtureData = fixtureData;
