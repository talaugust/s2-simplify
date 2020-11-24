import { SymbolUnderlineMethod } from "./EntityAnnotationLayer";

/**
 * Configurable app-wide settings. Whenever an experimental feature is added that should be
 * possible to toggle on / off (either during development, or when sharing a prototype with
 * a user / the team), add it to this list of settings instead of 'state' above. Settings from this
 * list can be configured in a developer's toolbar, and might eventually be set using
 * query parameters.
 */
export interface Settings {
  /**
   * Show a primer at the start of the document introducing the tool and definitions.
   */
  primerPageEnabled: boolean;
  /**
   * Show instructions in the primer describing how to use the tool.
   */
  primerInstructionsEnabled: boolean;
  /**
   * Style annotations to show hints that they're there (e.g., underlines).
   */
  annotationHintsEnabled: boolean;
  /**
   * Make entities (like symbols and terms) clickable.
   */
  annotationInteractionEnabled: boolean;
  /**
   * When the paper first loads, automatically scroll the the entity with this ID.
   */
  initialFocus: string | null;
  /**
   * Show glosses when an entity (i.e., symbol or term) is selected.
   */
  glossesEnabled: boolean;
  /**
   * Show glosses for citations containing paper summary information.
   */
  citationGlossesEnabled: boolean;
  /**
   * Show glosses for terms.
   */
  termGlossesEnabled: boolean;
  /**
   * How to determine whether to underline a symbol. For example, underlines can be placed
   * underneath all symbols with a definition, or under all top-level symbols.
   */
  symbolUnderlineMethod: SymbolUnderlineMethod;
  /**
   * Start a within-paper symbol search when a symbol is selected.
   */
  symbolSearchEnabled: boolean;
  /**
   * Enable the 'declutter' interaction which masks pages to show only those sentences that
   * contain an entity that the user selected.
   */
  declutterEnabled: boolean;
  /**
   * Show preview of the definition of a symbol a corner of the screen when that definition
   * is not already on the screen.
   */
  definitionPreviewEnabled: boolean;
  /**
   * Show callouts over equation when the equation is selected.
   */
  equationDiagramsEnabled: boolean;
  /**
   * Use nicknames and definitions to create diagram labels if no explicit diagram label
   * has been defined for the entity.
   */
  useDefinitionsForDiagramLabels: boolean;
  /**
   * Show menu of actions when text is selected.
   */
  textSelectionMenuEnabled: boolean;
  /**
   * Enable the annotation of new entities in the paper.
   */
  entityCreationEnabled: boolean;
  /**
   * Show the entity property editor for a selected entity.
   */
  entityEditingEnabled: boolean;
  /**
   * The presentation format of glosses (i.e., as tooltips, sidenotes, etc.)
   */
  glossStyle: GlossStyle;
  /**
   * Replace gloss contents with widgets for users to annotate the quality of gloss contents.
   */
  glossEvaluationEnabled: boolean;
  /**
   * Copy the TeX for sentences when a sentence is clicked on. Normally, this should probably be
   * disabled as it interferes with built-in text selection in pdf.js.
   */
  sentenceTexCopyOnOptionClickEnabled: boolean;
}

/**
 * A preset is a named, partial specification of settings.
 */
interface Preset extends Partial<Settings> {
  key: string;
}

/**
 * Define new presets for settings here.
 */
const PRESETS: Preset[] = [
  {
    key: "demo",
    primerInstructionsEnabled: false,
    useDefinitionsForDiagramLabels: true,
  },
  {
    key: "sab",
    termGlossesEnabled: false,
    citationGlossesEnabled: true,
    symbolUnderlineMethod: "defined-symbols",
    primerInstructionsEnabled: true,
  },
  {
    key: "sab-lite",
    symbolUnderlineMethod: "top-level-symbols",
    equationDiagramsEnabled: false,
  },
  {
    key: "study",
    primerInstructionsEnabled: false,
    citationGlossesEnabled: false,
    termGlossesEnabled: true,
    symbolUnderlineMethod: "defined-symbols",
    useDefinitionsForDiagramLabels: true,
  },
  /*
   * No interactivity for terms and symbols.
   */
  {
    key: "ca",
    annotationHintsEnabled: false,
    annotationInteractionEnabled: false,
    primerPageEnabled: false,
    equationDiagramsEnabled: false,
    glossesEnabled: false,
    declutterEnabled: false,
  },
  /*
   * Show declutter, not glosses.
   */
  {
    key: "cc",
    annotationInteractionEnabled: true,
    primerPageEnabled: false,
    glossesEnabled: false,
    equationDiagramsEnabled: false,
    declutterEnabled: true,
  },
  /*
   * Enable all of the interactive features.
   */
  {
    key: "cd",
    annotationInteractionEnabled: true,
    primerPageEnabled: true,
    glossesEnabled: true,
    equationDiagramsEnabled: true,
    declutterEnabled: true,
  },
  {
    key: "focused-reading",
    annotationInteractionEnabled: true,
    primerPageEnabled: true,
    glossesEnabled: true,
    equationDiagramsEnabled: true,
    declutterEnabled: true,
  },
  {
    key: "tp",
    initialFocus: "94185",
  },
  {
    key: "ta",
    initialFocus: "94247",
  },
  {
    key: "tb",
    initialFocus: "94110",
  },
  {
    key: "tc",
    initialFocus: "94159",
  },
  {
    key: "edit",
    annotationInteractionEnabled: true,
    primerPageEnabled: false,
    glossesEnabled: true,
    equationDiagramsEnabled: true,
    declutterEnabled: true,
    entityEditingEnabled: true,
    sentenceTexCopyOnOptionClickEnabled: true,
    useDefinitionsForDiagramLabels: true,
  },
  {
    key: "raymond",
    annotationInteractionEnabled: true,
    primerPageEnabled: false,
    glossesEnabled: true,
    equationDiagramsEnabled: true,
    declutterEnabled: true,
    useDefinitionsForDiagramLabels: true,
  },
  {
    key: "fp1q1",
    initialFocus: "115121",
  },
  {
    key: "fp1q2",
    initialFocus: "115121",
  },
  {
    key: "fp1q3",
    initialFocus: "115121",
  },
  {
    key: "fp1q4",
    initialFocus: "115186",
  },
  {
    key: "fp2q1",
    initialFocus: "94126"
  },
  {
    key: "fp2q2",
    initialFocus: "94179"
  },
  {
    key: "fp2q3",
    initialFocus: "95326"
  },
  {
    key: "fp2q4",
    initialFocus: "94189"
  },
];

/**
 * Get app settings, merging presets matching the key 'preset' with the default settings.
 */
export function getSettings(presets?: string[]) {
  const DEFAULT_SETTINGS: Settings = {
    primerPageEnabled: true,
    primerInstructionsEnabled: true,
    annotationInteractionEnabled: true,
    annotationHintsEnabled: true,
    glossesEnabled: true,
    initialFocus: null,
    glossStyle: "tooltip",
    textSelectionMenuEnabled: false,
    citationGlossesEnabled: true,
    termGlossesEnabled: true,
    symbolUnderlineMethod: "defined-symbols",
    symbolSearchEnabled: true,
    declutterEnabled: true,
    definitionPreviewEnabled: false,
    equationDiagramsEnabled: true,
    useDefinitionsForDiagramLabels: false,
    entityCreationEnabled: false,
    entityEditingEnabled: false,
    sentenceTexCopyOnOptionClickEnabled: false,
    glossEvaluationEnabled: false,
  };

  let settings = DEFAULT_SETTINGS;
  if (presets) {
    for (const preset of presets) {
      for (const p of PRESETS) {
        if (p.key === preset) {
          settings = { ...settings, ...p };
        }
      }
    }
  }
  return settings;
}

/**
 * A specification declaring how a setting should appear in a settings editor.
 */
export interface ConfigurableSetting {
  key: keyof Settings;
  /**
   * A setting can be one of the following types:
   * * flag: boolean yes / no option (can be switched on / off)
   * * choice: selection among multiple choices
   */
  type: "flag" | "choice";
  label: string;
  /**
   * Must be defined if 'type' is "choice".
   */
  choices?: string[];
}

export const GLOSS_STYLES = ["tooltip", "sidenote"] as const;
export type GlossStyle = typeof GLOSS_STYLES[number];

/**
 * Any setting that should be editable from the settings editor should have a spec in this list.
 */
export const CONFIGURABLE_SETTINGS: ConfigurableSetting[] = [
  {
    key: "primerPageEnabled",
    type: "flag",
    label: "Primer page",
  },
  {
    key: "annotationHintsEnabled",
    type: "flag",
    label: "Underline annotations",
  },
  {
    key: "glossStyle",
    type: "choice",
    label: "Gloss style",
    choices: [...GLOSS_STYLES],
  },
  {
    key: "glossEvaluationEnabled",
    type: "flag",
    label: "Evaluate glosses",
  },
  {
    key: "textSelectionMenuEnabled",
    type: "flag",
    label: "Show text selection menu",
  },
  {
    key: "citationGlossesEnabled",
    type: "flag",
    label: "Citation glosses",
  },
  {
    key: "symbolSearchEnabled",
    type: "flag",
    label: "Symbol search",
  },
  {
    key: "declutterEnabled",
    type: "flag",
    label: "Declutter interaction",
  },
  {
    key: "definitionPreviewEnabled",
    type: "flag",
    label: "Definition preview",
  },
  {
    key: "equationDiagramsEnabled",
    type: "flag",
    label: "Equation diagrams",
  },
  {
    key: "useDefinitionsForDiagramLabels",
    type: "flag",
    label: "Use definitions for diagram labels",
  },
  {
    key: "entityCreationEnabled",
    type: "flag",
    label: "Create entities",
  },
  {
    key: "entityEditingEnabled",
    type: "flag",
    label: "Edit entity properties",
  },
  {
    key: "sentenceTexCopyOnOptionClickEnabled",
    type: "flag",
    label: "<Opt> + <Click> to copy sentence TeX",
  },
];
