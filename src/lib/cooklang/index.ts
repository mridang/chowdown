/**
 * @packageDocumentation
 *
 * Public surface of the lib/cooklang package.
 */
export {
  appendCookingLog,
  appendNote,
  buildStubSource,
  domainOf,
  extractCookingLogs,
  extractNotes,
  flatNoteKey,
  isUncurated,
  normalizeSourceUrl,
  recipeDisplayName,
  removeEmptyMetadata,
  removeMetadata,
  removeNote,
  replaceNote,
  sanitiseName,
  sourceDomainOf,
  sourceUrlOf,
  UNCURATED_MARKER,
  uncuratedFilename,
  upsertMetadata,
  type CookingLogEntry,
  type Note,
} from './cook-text';
export {
  formatQuantity,
  parseRecipe,
  type ParsedIngredient,
  type ParsedRecipe,
  type StepToken,
} from './cooklang';
export {
  leadingUnit,
  parseIngredientLine,
  toCookIngredient,
  type ParsedIngredientLine,
} from './ingredient-line';
export {
  convertQuantity,
  convertRecipe,
  isUnitSystem,
  scaleQuantity,
  toBaseAmount,
  type BaseAmount,
  type UnitSystem,
} from './units';
