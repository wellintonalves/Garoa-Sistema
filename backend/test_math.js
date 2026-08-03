const dataIsoLocal = '2026-08-03T11:10:00';
const semZ = dataIsoLocal.replace('Z', '');
const final = semZ.includes('T') ? semZ : semZ + 'T00:00:00';
const dataInicio = new Date(final + '-03:00');
const reqInicioM = dataInicio.getUTCHours() * 60 + dataInicio.getUTCMinutes();
console.log('reqInicioM:', reqInicioM);

const agDate = new Date('2026-08-03T17:30:00.000Z');
const agInicioM = agDate.getUTCHours() * 60 + agDate.getUTCMinutes();
console.log('agInicioM:', agInicioM);

const duracaoMinutos = 30; // user said 30
const reqFimM = reqInicioM + duracaoMinutos;
const agFimM = agInicioM + duracaoMinutos;

console.log('reqInicioM < agFimM', reqInicioM < agFimM);
console.log('agInicioM < reqFimM', agInicioM < reqFimM);
console.log('conflita:', (reqInicioM < agFimM) && (agInicioM < reqFimM));
