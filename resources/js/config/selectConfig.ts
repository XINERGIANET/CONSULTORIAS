/**
 * Umbral para SmartSelect:
 * Si el total de opciones es <= SMART_SELECT_THRESHOLD → select nativo.
 * Si supera el umbral → select con búsqueda/autocomplete.
 * Modifica este valor para cambiar el comportamiento en todo el sistema.
 */
export const SMART_SELECT_THRESHOLD = 8;
