/** Brand-adjustable, procedural 3D avatar definitions. No external models or likenesses. */
export const AVATAR_3D_PROFILES=Object.freeze({
  nomi:{name:'Номи',kind:'robot',skin:'#f4fffb',body:'#45bca9',iris:'#1c807a',trim:'#246c67',accent:'#6ee2c8'},
  mira:{name:'Мира',kind:'human',skin:'#f0c6a9',body:'#968ce4',iris:'#554654',trim:'#62404a',accent:'#d3b5ed'},
  kiki:{name:'Кики',kind:'robot',skin:'#fff4df',body:'#f7b974',iris:'#875f44',trim:'#bc7853',accent:'#ffe0a4'},
  aria:{name:'Ариа',kind:'hologram',skin:'#d5f8ff',body:'#68bfe8',iris:'#386c96',trim:'#659ed4',accent:'#9deaf6'},
  bobo:{name:'Бобо',kind:'robot',skin:'#fff1fa',body:'#dc94c3',iris:'#744665',trim:'#9a6b93',accent:'#ffc0e5'}
});
export function clampAudioLevel(x){return typeof x==='number'&&Number.isFinite(x)?Math.max(0,Math.min(1,x)):0;}
export function resolveExpression(state){return ({speaking:'talking',listening:'attentive',wake:'attentive',connecting:'thinking',emergency:'concerned'})[state]||'neutral';}
