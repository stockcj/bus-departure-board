// Single source of truth for the stops shown on the board.
// Add a stop by appending its stopRef and display name here.
export const STOPS = [
  { id: '0500SCOMB004', name: 'Comberton - South Street' },
  { id: '0500CCITY119', name: 'Cambridge - Drummer Street Bay 3' },
  { id: '0500CCITY208', name: 'Cambridge - Catholic Church' },
  { id: '0500CCITY320', name: 'Downing College' },
  { id: '0500CCITY443', name: 'Long Road College' }
];

export const findStop = (id) => STOPS.find(s => s.id === id);

export const stopUrl = (id) =>
  `https://www.cambridgeshirebus.info/Popup_Content/WebDisplay/WebDisplay.aspx?stopRef=${id}`;
