import classNames from "classnames";
import React from "react";
import * as api from "./api/api";
import {
  Entity,
  EntityCreateData,
  EntityUpdateData,
  isAnswerSentence,
  isCitation,
  isEquation,
  isSymbol,
  isTerm,
  Paper,
  Symbol,
} from "./api/types";
import Control from "./components/control/Control";
import EntityCreationCanvas from "./components/control/EntityCreationCanvas";
import EntityCreationToolbar, {
  AreaSelectionMethod,
  createCreateEntityDataWithBoxes,
} from "./components/control/EntityCreationToolbar";
import MainControlPanel from "./components/control/MainControlPanel";
import TextSelectionMenu from "./components/control/TextSelectionMenu";
import { Drawer, DrawerContentType } from "./components/drawer/Drawer";
import EntityAnnotationLayer from "./components/entity/EntityAnnotationLayer";
import EquationDiagram from "./components/entity/equation/EquationDiagram";
import EntityPageMask from "./components/mask/EntityPageMask";
import SearchPageMask from "./components/mask/SearchPageMask";
import AppOverlay from "./components/overlay/AppOverlay";
import PageOverlay from "./components/overlay/PageOverlay";
import ViewerOverlay from "./components/overlay/ViewerOverlay";
import DefinitionPreview from "./components/preview/DefinitionPreview";
import PrimerPage from "./components/primer/PrimerPage";
import FAQBar from "./components/questions/FAQBar";
import FindBar, { FindQuery } from "./components/search/FindBar";
import * as EntitiesTutorial from "./data/annotations_tutorial.json";
import * as EntitiesSLE from "./data/auto_PAWLS_SPUI_annotations.json";
//added
import * as EntitiesLDH from "./data/auto_PAWLS_SPUI_annotations_ldh.json";
import logger from "./logging";
import * as selectors from "./selectors";
import { matchingSymbols } from "./selectors";
import {
  ConfigurableSetting,
  CONFIGURABLE_SETTINGS,
  getSettings,
  GlossStyle,
} from "./settings";
import {
  Entities,
  KnownEntityType,
  Pages,
  PaperId,
  State,
  SymbolFilters,
} from "./state";
import "./style/index.less";
import {
  DocumentLoadedEvent,
  PageRenderedEvent,
  PDFViewerApplication,
} from "./types/pdfjs-viewer";
import * as stateUtils from "./utils/state";
import * as uiUtils from "./utils/ui";

interface Props {
  paperId?: PaperId;
  presets?: string[];
  context?: any;
}

export default class ScholarReader extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const settings = getSettings(props.presets);
    const loggingContext: any = { ...props.context };
    if (props.presets) {
      loggingContext.presets = props.presets;
    }
    if (props.paperId) {
      loggingContext.paperId = props.paperId;
      let paper_name = props.paperId.id.split("/");
    }
    logger.setContext(loggingContext);

    this.state = {
      entities: { all: [], byId: {} },
      lazyPapers: new Map(),

      pages: null,
      pdfViewerApplication: null,
      pdfDocument: null,
      pdfViewer: null,

      controlPanelShowing: false,

      areCitationsLoading: false,

      selectedAnnotationIds: [],
      selectedAnnotationSpanIds: [],
      selectedEntityIds: [],
      multiselectEnabled: false,
      jumpTarget: null,

      textSelection: null,
      textSelectionChangeMs: null,

      isFindActive: false,
      findMode: null,
      findActivationTimeMs: null,
      findQuery: null,
      findMatchIndex: null,
      findMatchCount: null,
      findMatchedEntities: null,
      drawerMode: "closed", //swapped
      drawerContentType: null,
      snackbarMode: "closed",
      snackbarActivationTimeMs: null,
      snackbarMessage: null,

      entityCreationAreaSelectionMethod: "text-selection",
      entityCreationType: "term",
      propagateEntityEdits: true,

      FAQHoveredID: null,
      selectedFAQID: null,

      ...settings,
    };
  }

  toggleControlPanelShowing = (): void => {
    this.setState((prevState) => ({
      controlPanelShowing: !prevState.controlPanelShowing,
    }));
  };

  toggleAnnotationHints = (): void => {
    this.setState((prevState) => ({
      annotationHintsEnabled: !prevState.annotationHintsEnabled,
    }));
  };

  setAnnotationHintsEnabled = (enabled: boolean): void => {
    this.setState({ annotationHintsEnabled: enabled });
  };

  setGlossStyle = (style: GlossStyle): void => {
    this.setState({ glossStyle: style });
  };

  closeControlPanel = (): void => {
    this.setState({ controlPanelShowing: false });
  };

  handleChangeSetting = (setting: ConfigurableSetting, value: any): void => {
    this.setState({
      [setting.key]: value,
    } as State);
  };

  setTextSelection = (selection: Selection | null): void => {
    this.setState({
      textSelection: selection,
      textSelectionChangeMs: Date.now(),
    });
  };

  selectEntity = (id: string): void => {
    this.selectEntityAnnotation(id);
  };

  handleFAQMouseEnter = (id: string): void => {
    this.setState({ FAQHoveredID: id });
  };

  handleFAQMouseLeave = (id: string): void => {
    this.setState((state) => {
      if (state.FAQHoveredID === id) {
        return { FAQHoveredID: null };
      }
      return { FAQHoveredID: id };
    });
  };

  handleFAQClick = (id: string): void => {
    this.setState({ selectedFAQID: id });
  };

  handleFAQMouseOver = (id: string): void => {
    this.setState({ FAQHoveredID: id });
  };

  handleFAQMouseOut = (id: string): void => {
    this.setState({ FAQHoveredID: null });
  };

  selectEntityAnnotation = (
    entityId: string,
    annotationId?: string,
    annotationSpanId?: string
  ): void => {
    const entityType = this.state.entities?.byId[entityId].type;
    logger.log("debug", "select-entity", {
      entityId,
      entityType,
      annotationId,
      annotationSpanId,
    });

    this.setState((prevState) => {
      const prevEntities = prevState.entities;
      if (prevEntities === null) {
        return {};
      }

      const selectedEntityIds = prevState.multiselectEnabled
        ? [...prevState.selectedEntityIds]
        : [];
      const selectedAnnotationIds = prevState.multiselectEnabled
        ? [...prevState.selectedAnnotationIds]
        : [];
      const selectedAnnotationSpanIds = prevState.multiselectEnabled
        ? [...prevState.selectedAnnotationSpanIds]
        : [];
      if (selectedEntityIds.indexOf(entityId) === -1) {
        selectedEntityIds.push(entityId);
      }
      if (annotationId && selectedAnnotationIds.indexOf(annotationId) === -1) {
        selectedAnnotationIds.push(annotationId);
      }
      if (
        annotationSpanId &&
        selectedAnnotationSpanIds.indexOf(annotationSpanId) === -1
      ) {
        selectedAnnotationSpanIds.push(annotationSpanId);
      }

      logger.log("debug", "selection-updated", {
        selectedEntityIds,
        selectedAnnotationIds,
        selectedAnnotationSpanIds,
      });

      /*
       * The default behavior is to just update the selection. If the selection is a,
       * searchable type of entity, however, start a search.
       */
      const entityType = prevEntities.byId[entityId].type;
      if (["symbol", "term"].indexOf(entityType) === -1) {
        return {
          selectedEntityIds,
          selectedAnnotationIds,
          selectedAnnotationSpanIds,
          jumpTarget: null,
        } as State;
      }

      /*
       * If this is a term, start a term search.
       */
      if (entityType === "term") {
        const termIds = selectedEntityIds.filter(
          (id) => prevEntities.byId[id].type === "term"
        );
        const matching = selectors.matchingTerms(termIds, prevEntities);
        const matchCount = matching.length;
        const matchIndex = matching.indexOf(entityId);
        logger.log("debug", "starting-term-search", { matchIndex, matchCount });
        return {
          selectedEntityIds,
          selectedAnnotationIds,
          selectedAnnotationSpanIds,
          isFindActive: true,
          findMode: "term",
          findActivationTimeMs: Date.now(),
          findQuery: prevEntities.byId[entityId],
          findMatchCount: matchCount,
          findMatchIndex: matchIndex,
          findMatchedEntities: matching,
          jumpTarget: null,
        } as State;
      }

      /*
       * If this is a symbol, start a symbol search.
       */
      const symbolIds = selectedEntityIds.filter(
        (id) => prevEntities.byId[id].type === "symbol"
      );
      const matching = matchingSymbols(symbolIds, prevEntities);
      const matchCount = matching.length;
      const matchIndex = matching.indexOf(entityId);
      logger.log("debug", "starting-symbol-search", { matchIndex, matchCount });
      return {
        selectedEntityIds,
        selectedAnnotationIds,
        selectedAnnotationSpanIds,
        isFindActive: true,
        findMode: "symbol",
        findActivationTimeMs: Date.now(),
        findQuery: {
          byId: {
            [entityId]: {
              symbol: prevEntities.byId[entityId],
              active: true,
            },
          },
          all: [entityId],
        } as FindQuery,
        findMatchCount: matchCount,
        findMatchIndex: matchIndex,
        findMatchedEntities: matching,
        jumpTarget: null,
      } as State;
    });
  };

  clearEntitySelection = (): void => {
    logger.log("debug", "clear-entity-selection");

    /*
     * If interaction with entities is currently turned off, then nothing was selected in the
     * first place. Don't change the state, incase the selected annotation list or the jump
     * target contains important highlights that shouldn't be dismissed.
     */
    if (!this.state.annotationInteractionEnabled) {
      return;
    }

    if (this.state.findMode === "symbol" || this.state.findMode === "term") {
      this.closeFindBar();
    }
    this.setState({
      selectedAnnotationIds: [],
      selectedAnnotationSpanIds: [],
      selectedEntityIds: [],
      jumpTarget: null,
    });
  };

  setEntityCreationType = (type: KnownEntityType): void => {
    this.setState({ entityCreationType: type });
  };

  setEntityCreationAreaSelectionMethod = (
    method: AreaSelectionMethod
  ): void => {
    this.setState({ entityCreationAreaSelectionMethod: method });
  };

  createEntity = async (data: EntityCreateData): Promise<string | null> => {
    if (this.props.paperId !== undefined) {
      console.log("Trying to create entity...");
      const createdEntity = await api.postEntity(this.props.paperId.id, data);
      if (createdEntity !== null) {
        this.setState((prevState) => ({
          /*
           * Add the entity to memory
           */
          entities: stateUtils.add(
            prevState.entities,
            createdEntity.id,
            createdEntity
          ),
          /*
           * Select the new entity
           */
          selectedEntityIds: [createdEntity.id],
        }));
        return createdEntity.id;
      }
    }
    return null;
  };

  createParentSymbol = async (childSymbols: Symbol[]): Promise<boolean> => {
    /*
     * Parent bounding box is the union of child bounding boxes.
     */
    const childBoxes = childSymbols
      .map((c) => c.attributes.bounding_boxes)
      .flat();
    if (childBoxes.length === 0) {
      return false;
    }
    const left = Math.min(...childBoxes.map((b) => b.left));
    const top = Math.min(...childBoxes.map((b) => b.top));
    const right = Math.max(...childBoxes.map((b) => b.left + b.width));
    const bottom = Math.max(...childBoxes.map((b) => b.top + b.height));
    const parentBox = {
      left,
      top,
      width: right - left,
      height: bottom - top,
      page: childBoxes[0].page,
      source: "human-annotation",
    };

    /*
     * Transfer TeX and sentence references from children to parent. Attempt to create
     * parent TeX by removing TeX markers (e.g., leading and training '$') from child
     * TeX and then concatenating all child TeX.
     */
    const allChildTex = childSymbols
      .map((s) => s.attributes.tex || "")
      .map((tex) => tex.replace(/^\$*/, "").replace(/\$*$/, ""))
      .join(" ");
    const createEntityData = createCreateEntityDataWithBoxes(
      [parentBox],
      "symbol",
      allChildTex
    );
    const childIds = childSymbols.map((c) => c.id);
    const sentenceId =
      childSymbols
        .map((c) => c.relationships.sentence.id)
        .filter((id) => id !== null)[0] || null;
    createEntityData.relationships = {
      ...createEntityData.relationships,
      children: childIds.map((id) => ({ type: "symbol", id })),
      sentence: { type: "sentence", id: sentenceId },
    };

    /*
     * Create parent symbol.
     */
    const parentId = await this.createEntity(createEntityData);
    if (parentId === null) {
      return false;
    }

    /*
     * Update children to reference the parent.
     */
    for (const child of childSymbols) {
      const updateData = {
        id: child.id,
        type: "symbol",
        attributes: {
          source: "human-annotation",
        },
        relationships: {
          parent: { type: "symbol", id: parentId },
        },
      } as EntityUpdateData;
      const success = await this.updateEntity(child, updateData, false);
      if (!success) {
        return false;
      }
    }

    return true;
  };

  updateEntity = async (
    entity: Entity,
    updateData: EntityUpdateData,
    propagateEdits?: boolean
  ): Promise<boolean> => {
    const { paperId } = this.props;
    if (paperId === undefined) {
      return false;
    }

    /*
     * By default, only update this one entity. If edits are supposed to be
     * propagated to other matching entities, build a list matching entities to update.
     */
    const entitiesToPatch = [entity.id];
    const entities = this.state.entities;
    if (
      (propagateEdits === true ||
        (propagateEdits === undefined && this.state.propagateEntityEdits)) &&
      entities !== null
    ) {
      entitiesToPatch.push(
        ...entities.all
          .map((id) => entities.byId[id])
          .filter((e) => {
            if (e.id === entity.id) {
              return false;
            } else if (isSymbol(entity) && isSymbol(e)) {
              return entity.attributes.tex === e.attributes.tex;
            } else if (isTerm(entity) && isTerm(e)) {
              return entity.attributes.name === e.attributes.name;
            }
            return false;
          })
          .map((e) => e.id)
      );
    }

    /*
     * Patch entities, saving which ones were successfully updated.
     */
    console.log("Patching...");
    const patchedEntities = await Promise.all(
      entitiesToPatch.map((id) =>
        api.patchEntity(paperId.id, { ...updateData, id })
      )
    ).then((successes) =>
      successes
        .map((success, i) => (success ? entitiesToPatch[i] : undefined))
        .filter((id) => id !== undefined)
        .map((id) => id as string)
    );

    /*
     * Update entities in memory. Only update those that were successfully patched.
     */
    this.setState((prevState) => {
      const prevEntities = prevState.entities;
      if (prevEntities !== null) {
        let nextEntities = { ...prevEntities };
        patchedEntities.forEach((id) => {
          const prevEntity = prevEntities.byId[id];
          const updated = {
            ...prevEntity,
            attributes: { ...prevEntity.attributes, ...updateData.attributes },
            relationships: {
              ...prevEntity.relationships,
              ...updateData.relationships,
            },
          };
          nextEntities = stateUtils.update(nextEntities, id, updated);
        });
        return {
          entities: nextEntities,
        };
      }
      return { entities: prevState.entities };
    });

    const completeSuccess = entitiesToPatch.length === patchedEntities.length;
    return completeSuccess;
  };

  deleteEntity = async (id: string): Promise<boolean> => {
    console.log("deleting....");
    if (this.props.paperId !== undefined) {
      const result = await api.deleteEntity(this.props.paperId.id, id);
      if (result) {
        this.setState((prevState) => {
          /*
           * Delete the entity from memory.
           */
          const updatedEntities = stateUtils.del(prevState.entities, id);

          /*
           * Deselect the entity if it's currently selected.
           */
          let selectionState;
          if (prevState.selectedEntityIds.indexOf(id) !== -1) {
            selectionState = {
              selectedEntityIds: [],
              selectedAnnotationIds: [],
              selectedAnnotationSpanIds: [],
            };
          } else {
            selectionState = {
              selectedEntityIds: prevState.selectedEntityIds,
              selectedAnnotationIds: prevState.selectedAnnotationIds,
              selectedAnnotationSpanIds: prevState.selectedAnnotationSpanIds,
            };
          }

          return { ...selectionState, entities: updatedEntities };
        });
        return true;
      }
    }
    return false;
  };

  showSnackbarMessage = (message: string): void => {
    this.setState({
      snackbarMode: "open",
      snackbarActivationTimeMs: Date.now(),
      snackbarMessage: message,
    });
  };

  closeSnackbar = (): void => {
    this.setState({
      snackbarMode: "closed",
      snackbarActivationTimeMs: null,
      snackbarMessage: null,
    });
  };

  openDrawer = (drawerContentType: DrawerContentType): void => {
    logger.log("debug", "request-open-drawer", { drawerContentType });
    this.setState({
      drawerMode: "open",
      drawerContentType,
    });
  };

  toggleDrawer = (): void => {
    if (this.state.drawerMode === "open") {
      this.setState({ drawerMode: "closed" });
    } else {
      this.setState({ drawerMode: "open" });
    }
  };

  closeDrawer = (): void => {
    logger.log("debug", "close-drawer");
    this.setState({ drawerMode: "closed" });
  };

  setMultiselectEnabled = (enabled: boolean): void => {
    this.setState({ multiselectEnabled: enabled });
  };

  setPropagateEntityEdits = (propagate: boolean): void => {
    this.setState({
      propagateEntityEdits: propagate,
    });
  };

  startTextSearch = (): void => {
    logger.log("debug", "start-text-search");
    this.setState({
      isFindActive: true,
      findActivationTimeMs: Date.now(),
      findMode: "pdfjs-builtin-find",
    });
  };

  setFindMatchCount = (findMatchCount: number | null): void => {
    logger.log("debug", "find-match-count-updated", { count: findMatchCount });
    this.setState({ findMatchCount });
  };

  setFindMatchIndex = (findMatchIndex: number | null): void => {
    logger.log("debug", "find-match-index-updated", {
      index: findMatchIndex,
      count: this.state.findMatchCount,
    });
    this.setState((state) => {
      if (
        (state.findMode === "symbol" || state.findMode === "term") &&
        state.findMatchedEntities !== null &&
        findMatchIndex !== null &&
        state.entities !== null
      ) {
        const entityId = state.findMatchedEntities[findMatchIndex];
        this.jumpToEntity(entityId);
      }
      return { findMatchIndex };
    });
  };

  setFindQuery = (findQuery: FindQuery): void => {
    this.setState((state) => {
      if (state.findMode === "symbol" && state.entities !== null) {
        const selectedSymbolIds = selectors.symbolIds(
          state.entities,
          state.selectedEntityIds
        );
        if (selectedSymbolIds.length === 0) {
          return {};
        }

        const symbolFilters = findQuery as SymbolFilters;
        const filterList =
          symbolFilters !== null
            ? Object.values(symbolFilters.byId)
            : undefined;
        const matching = matchingSymbols(
          selectedSymbolIds,
          state.entities,
          filterList
        );
        const matchCount = matching.length;
        const lastSelectedSymbolId =
          selectedSymbolIds[selectedSymbolIds.length - 1];
        const matchIndex = matching.indexOf(lastSelectedSymbolId);
        return {
          findQuery,
          findMatchCount: matchCount,
          findMatchIndex: matchIndex,
          findMatchedEntities: matching,
        } as State;
      }
      return { findQuery } as State;
    });
  };

  closeFindBar = (): void => {
    logger.log("debug", "find-close");
    this.setState({
      isFindActive: false,
      findActivationTimeMs: null,
      findMode: null,
      findQuery: null,
      findMatchCount: null,
      findMatchIndex: null,
      findMatchedEntities: null,
    });
  };

  componentDidMount() {
    waitForPDFViewerInitialization().then((application) => {
      logger.log("debug", "application-loaded");
      /*
       * Tell pdf.js not to use default find functionality, but instead to forward find events
       * to external services. The events are intercepted in 'FindBar'.
       */
      application.externalServices.supportsIntegratedFind = true;

      this.setState({ pdfViewerApplication: application });
      this.subscribeToPDFViewerStateChanges(application);
    });
    this.loadDataFromApi();
  }

  subscribeToPDFViewerStateChanges = (
    pdfViewerApplication: PDFViewerApplication
  ): void => {
    const { eventBus, pdfDocument, pdfViewer } = pdfViewerApplication;

    if (pdfDocument !== null) {
      this.setState({ pdfDocument });
    }
    if (pdfViewer !== null) {
      this.setState({ pdfViewer });
    }
    eventBus.on("documentloaded", (eventData: DocumentLoadedEvent) => {
      this.setState({ pdfDocument: eventData.source });
      setTimeout(() => {
        (window.PDFViewerApplication as any).pdfSidebar.switchView(3);
      }, 1);
    });

    /*
     * TODO(andrewhead): Do we need to add pages that are *already loaded* at initialization time
     * to the state? Or will 'pagerendered' always run after this component is mounted?
     */
    eventBus.on("pagerendered", (eventData: PageRenderedEvent) => {
      this.setState({
        pdfDocument: pdfViewerApplication.pdfDocument,
        pages: {
          ...this.state.pages,
          [uiUtils.getPageNumber(eventData.source)]: {
            timeOfLastRender: eventData.timestamp,
            view: eventData.source,
          },
        },
      });
    });
  };

  loadDataFromApi = async (): Promise<void> => {
    // if (this.props.paperId !== undefined && this.props.paperId.type === "arxiv") { // swapped
    if (true) {
      const loadingStartTime = performance.now();

      // trick the typescript compiler, which gets the type of testEntities
      // wrong for some reason.

      // make sure you take the correct entities for the paper

      const paperNameSplit = this.props.paperId?.id.split("/");
      const paperName = paperNameSplit
        ? paperNameSplit[paperNameSplit.length - 1]
        : null;
      let entitiesFromJson = null;

      if (paperName === "Lupus_Peptides.pdf") {
        entitiesFromJson = (EntitiesSLE as any) as { default: Entity[] };
      } else if (paperName === "LDH_surgery.pdf") {
        entitiesFromJson = (EntitiesLDH as any) as { default: Entity[] };
      } else if (paperName === "tutorial.pdf") {
        entitiesFromJson = (EntitiesTutorial as any) as { default: Entity[] };
      }
      const entities = entitiesFromJson ? entitiesFromJson.default : [];

      // const entities = await api.getDedupedEntities(this.props.paperId.id, true);
      this.setState({
        entities: stateUtils.createRelationalStoreFromArray(entities, "id"),
      });

      // // added

      const citationS2Ids = entities
        .filter(isCitation)
        .map((c) => c.attributes.paper_id)
        .filter((id) => id !== null)
        .map((id) => id as string);

      if (window.heap) {
        const loadingTimeMS = Math.round(performance.now() - loadingStartTime);
        window.heap.track("paper-loaded", {
          loadingTimeMS,
          numEntities: entities.length,
          numCitations: citationS2Ids.length,
        });
      }
    }
  };

  cachePaper = (paper: Paper, cb?: () => void): void => {
    const paperMap = new Map(this.state.lazyPapers);
    paperMap.set(paper.s2Id, paper);
    this.setState(
      {
        lazyPapers: paperMap,
      },
      cb
    );
  };

  jumpToEntityWithBackMessage = (id: string): void => {
    const success = this.jumpToEntity(id);

    if (success && !this._backButtonHintShown) {
      this.showSnackbarMessage(
        "Resume where you left by pressing the browser '←' button."
      );
      // this._backButtonHintShown = true;
    }
  };

  jumpToEntity = (id: string): boolean => {
    /*
     * In a past version, these offsets were based roughly off those in the pdf.js "find" functionality:
     * https://github.com/mozilla/pdf.js/blob/16ae7c6960c1296370c1600312f283a68e82b137/web/pdf_find_controller.js#L28-L29
     */
    const SCROLL_OFFSET_X = -1000;
    const SCROLL_OFFSET_Y = 0;

    const { pdfViewerApplication, pdfViewer, pages, entities } = this.state;

    if (
      entities === null ||
      entities.byId[id] === undefined ||
      entities.byId[id].attributes.bounding_boxes.length === 0 ||
      pdfViewerApplication === null ||
      pdfViewer === null ||
      pages === null ||
      Object.values(pages).length === 0
    ) {
      return false;
    }
    // if there are multiple bouding boxes, pick the one that appears first in the paper.
    const entity = entities.byId[id];
    let dest = entity.attributes.bounding_boxes.sort((b1, b2) => {
      if (b1.page !== b2.page) {
        return b1.page - b2.page;
      }
      return b2.top - b1.top;
    })[entity.attributes.bounding_boxes.length - 1];
    // if (entity.attributes.bounding_boxes.length > 1){
    //   dest = entity.attributes.bounding_boxes[entity.attributes.bounding_boxes.length - 1];
    // }

    /*
     * Use the size of the first loaded page to map from ratio-based entity
     * dimensions and absolute positions on the page. Note that this mapping will not work
     * if pages in a PDF have different dimensions.
     */
    const page = Object.values(pages)[0];
    let destCopy = { ...dest };
    let { left, top } = uiUtils.convertBoxToPdfCoordinates(page.view, dest);
    top = top + 80;

    /*
     * Scroll to the destination. Use the 'navigateTo', which will save
     * the current location to history so that when a user clicks the 'Back' button, it takes
     * them back to where they were before.
     */
    // pdfViewerApplication.pdfLinkService.navigateTo([
    //   dest.page,
    //   { name: "XYZ" },
    //   left + SCROLL_OFFSET_X,
    //   top + SCROLL_OFFSET_Y,
    // ]);

    pdfViewer.scrollPageIntoView({
      pageNumber: dest.page + 1,
      destArray: [
        undefined,
        { name: "XYZ" },
        SCROLL_OFFSET_X,
        top + SCROLL_OFFSET_Y,
      ],
      allowNegativeOffset: true,
    });

    // setTimeout(function () {pdfViewerApplication.pdfViewer.container.scrollLeft -= 300}, 50)

    /*
     * Store the position that the paper has jumped to.
     */
    this.setState({
      jumpTarget: id,
    });

    /*
     * added: also select the entity
     */
    const annotationID = `entity-${id}-annotation`;

    let annotationSpanIDs = new Array(entity.attributes.bounding_boxes.length);
    let counter = 0;
    for (let i = 0; i < annotationSpanIDs.length; i++) {
      let pageNumber = entity.attributes.bounding_boxes[i].page;
      if (i > 0 && pageNumber != entity.attributes.bounding_boxes[i - 1].page) {
        // reset the counter
        counter = 0;
      }
      annotationSpanIDs[
        i
      ] = `${annotationID}-page-${pageNumber}-span-${counter}`;
      counter += 1;
    }

    // const annotationSpanIDs = entity.attributes.bounding_boxes.map((box, i, boxes) => {

    //   const pageNumber = box.page;
    //   if (pageNumber != boxes[i-1].page) {
    //     return `${annotationID}-page-${pageNumber}-span-${0}`;
    //   }
    //   return `${annotationID}-page-${pageNumber}-span-${i}`;
    // });

    this.selectEntityAnnotation(
      id,
      annotationID,
      annotationSpanIDs[annotationSpanIDs.length - 1]
    );

    // if (entity.attributes.bounding_boxes.length > 1) {
    //   this.selectEntityAnnotation(
    //     id,
    //     annotationID,
    //     annotationSpanIDs[annotationSpanIDs.length - 1]
    //   );
    // } else {
    //   this.selectEntityAnnotation(id, annotationID, annotationSpanIDs[0]);
    // }

    return true;
  };

  render() {
    let findMatchEntityId: string | null = null;
    if (
      this.state.findMatchedEntities !== null &&
      this.state.findMatchIndex !== null &&
      this.state.findMatchIndex < this.state.findMatchedEntities.length
    ) {
      findMatchEntityId = this.state.findMatchedEntities[
        this.state.findMatchIndex
      ];
    }

    if (
      !this._jumpedToInitialFocus &&
      this.state.pages !== null &&
      Object.keys(this.state.pages).length > 0 &&
      this.state.entities !== null
    ) {
      if (this.state.initialFocus !== null) {
        this.jumpToEntity(this.state.initialFocus);
        logger.log("debug", "jump-page-to-initial-focus", {
          entityId: this.state.initialFocus,
        });
      }
      this._jumpedToInitialFocus = true;
    }

    return (
      <>
        {this.state.pdfViewerApplication !== null &&
        this.state.pdfViewer !== null ? (
          <>
            {/* Render the widgets and event handlers for the entire app and viewer containers. */}
            <AppOverlay
              appContainer={document.body}
              snackbarMode={this.state.snackbarMode}
              snackbarActivationTimeMs={this.state.snackbarActivationTimeMs}
              snackbarMessage={this.state.snackbarMessage}
              handleToggleControlPanelShowing={this.toggleControlPanelShowing}
              handleSetMultiselectEnabled={this.setMultiselectEnabled}
              handleStartTextSearch={this.startTextSearch}
              handleTerminateSearch={this.closeFindBar}
              handleCloseSnackbar={this.closeSnackbar}
              handleCloseDrawer={this.closeDrawer}
            />
            {/* <PdfjsToolbar>
              <button
                onClick={this.toggleAnnotationHints}
                className="toolbarButton hiddenLargeView pdfjs-toolbar__button"
              >
                <span>
                  {this.state.annotationHintsEnabled
                    ? "Hide Underlines"
                    : "Show Underlines"}
                </span>
              </button>
            </PdfjsToolbar> */}
            {/* For the FAQs */}
            {/* {this.state.FAQsEnabled ? (
              <PdfjsToolbar>
                <button
                  onClick={this.toggleDrawer}
                  className="toolbarButton hiddenLargeView pdfjs-toolbar__button"
                >
                  <span>
                    {this.state.drawerMode ? "Show FAQs" : "Hide FAQs"}
                  </span>
                </button>
              </PdfjsToolbar>
            ) : null} */}
            {/* <PdfjsBrandbar /> */}
            <ViewerOverlay
              pdfViewer={this.state.pdfViewer}
              handleSetTextSelection={this.setTextSelection}
              handleClearEntitySelection={this.clearEntitySelection}
            >
              <div
                className={classNames("scholar-reader-toolbar-container", {
                  "snackbar-showing": this.state.snackbarMode === "open",
                })}
              >
                {this.state.controlPanelShowing ? (
                  <MainControlPanel
                    className="scholar-reader-toolbar"
                    handleClose={this.closeControlPanel}
                  >
                    {CONFIGURABLE_SETTINGS.map((setting) => (
                      <Control
                        key={setting.label}
                        setting={setting}
                        value={this.state[setting.key]}
                        handleChange={this.handleChangeSetting}
                      />
                    ))}
                  </MainControlPanel>
                ) : null}
                {this.state.isFindActive &&
                this.state.findActivationTimeMs !== null &&
                (this.state.findMode !== "symbol" ||
                  this.state.symbolSearchEnabled) ? (
                  <FindBar
                    className="scholar-reader-toolbar"
                    /*
                     * Set the key for the widget to the time that the find event was activated
                     * (i.e., when 'Ctrl+F' was typed). This regenerates the widgets whenever
                     * a new 'find' action is started, which will select and focus the text
                     * in the search widget. See why we use key to regenerate component here:
                     * https://reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html#recommendation-fully-uncontrolled-component-with-a-key
                     */
                    key={this.state.findActivationTimeMs}
                    matchCount={this.state.findMatchCount}
                    matchIndex={this.state.findMatchIndex}
                    mode={this.state.findMode}
                    pdfViewerApplication={this.state.pdfViewerApplication}
                    query={this.state.findQuery}
                    handleChangeMatchCount={this.setFindMatchCount}
                    handleChangeMatchIndex={this.setFindMatchIndex}
                    handleChangeQuery={this.setFindQuery}
                    handleClose={this.closeFindBar}
                  />
                ) : null}
                {this.state.entityCreationEnabled &&
                this.state.pages !== null ? (
                  <EntityCreationToolbar
                    className="scholar-reader-toolbar"
                    pages={this.state.pages}
                    entities={this.state.entities}
                    selectedEntityIds={this.state.selectedEntityIds}
                    entityType={this.state.entityCreationType}
                    selectionMethod={
                      this.state.entityCreationAreaSelectionMethod
                    }
                    handleShowSnackbarMessage={this.showSnackbarMessage}
                    handleSelectEntityType={this.setEntityCreationType}
                    handleSelectSelectionMethod={
                      this.setEntityCreationAreaSelectionMethod
                    }
                    handleCreateEntity={this.createEntity}
                    handleCreateParentSymbol={this.createParentSymbol}
                  />
                ) : null}
                {this.props.children}
              </div>
              {this.state.textSelectionMenuEnabled &&
              this.state.pages !== null ? (
                <TextSelectionMenu
                  key={this.state.textSelectionChangeMs || undefined}
                  pages={this.state.pages}
                  textSelection={this.state.textSelection}
                  handleShowSnackbarMessage={this.showSnackbarMessage}
                />
              ) : null}
              <Drawer
                pdfViewer={this.state.pdfViewer}
                mode={
                  this.state.drawerMode === "open" ||
                  this.state.entityEditingEnabled
                    ? "open"
                    : "closed"
                }
                contentType={
                  this.state.entityEditingEnabled
                    ? "entity-property-editor"
                    : this.state.drawerContentType
                }
                entities={this.state.entities}
                selectedEntityIds={this.state.selectedEntityIds}
                propagateEntityEdits={this.state.propagateEntityEdits}
                handleJumpToEntity={this.jumpToEntityWithBackMessage}
                handleClose={this.closeDrawer}
                handleUpdateEntity={this.updateEntity}
                handleDeleteEntity={this.deleteEntity}
                handleSetPropagateEntityEdits={this.setPropagateEntityEdits}
              />
              {this.state.definitionPreviewEnabled &&
              this.state.pages !== null &&
              this.state.pdfDocument !== null &&
              this.state.entities !== null ? (
                <DefinitionPreview
                  pdfViewer={this.state.pdfViewer}
                  pdfDocument={this.state.pdfDocument}
                  pages={this.state.pages}
                  entities={this.state.entities}
                  selectedEntityIds={this.state.selectedEntityIds}
                />
              ) : null}
              {this.state.FAQsEnabled ? (
                <FAQBar
                  pdfViewer={this.state.pdfViewer}
                  mode={this.state.drawerMode}
                  contentType={"definitions"}
                  entities={this.state.entities}
                  selectedEntityIds={this.state.selectedEntityIds}
                  propagateEntityEdits={this.state.propagateEntityEdits}
                  handleJumpToEntity={this.jumpToEntityWithBackMessage}
                  handleClose={this.closeDrawer}
                  handleMouseEnter={this.handleFAQMouseEnter}
                  handleMouseLeave={this.handleFAQMouseLeave}
                  handleClick={this.handleFAQClick}
                  handleSetPropagateEntityEdits={this.setPropagateEntityEdits}
                  FAQHoveredID={this.state.FAQHoveredID}
                  selectedFAQID={this.state.selectedFAQID}
                />
              ) : null}
            </ViewerOverlay>
          </>
        ) : null}
        {this.state.primerPageEnabled &&
        this.state.pdfViewer !== null &&
        this.state.pages !== null ? (
          <PrimerPage
            paperId={this.props.paperId}
            pdfViewer={this.state.pdfViewer}
            pages={this.state.pages}
            entities={this.state.entities}
            annotationHintsEnabled={this.state.annotationHintsEnabled}
            primerPageGlossaryEnabled={this.state.primerPageGlossaryEnabled}
            termGlossesEnabled={this.state.termGlossesEnabled}
            showInstructions={this.state.primerInstructionsEnabled}
            scrollToPageOnLoad={this.state.initialFocus === null}
            handleSetAnnotationHintsEnabled={this.setAnnotationHintsEnabled}
            areCitationsLoading={this.state.areCitationsLoading}
          />
        ) : null}
        {
          /* Add overlays (e.g., annotations, etc.) atop each page. */
          this.state.pages !== null && this.state.entities !== null ? (
            <>
              {Object.keys(this.state.pages).map((pageNumberKey) => {
                const pages = this.state.pages as Pages;
                const entities = this.state.entities as Entities;

                const pageNumber = Number(pageNumberKey);
                const pageModel = pages[pageNumber];
                const pageView = pageModel.view;

                /*
                 * By setting the key to the page number *and* the timestamp it was rendered, React will
                 * know to replace a page overlay when a pdf.js re-renders a page.
                 */
                const key = `${pageNumber}-${pageModel.timeOfLastRender}`;

                /*
                 * Prevent unnecessary renders by only passing in the subset of selected entity and
                 * annotation IDs for this page. The PageOverlay performs a deep comparison of the
                 * lists of IDs to determine whether to re-render.
                 */
                const selectedEntityIds = selectors.entityIdsInPage(
                  this.state.selectedEntityIds,
                  this.state.entities,
                  pageNumber
                );
                const selectedAnnotationIds = selectors.annotationsInPage(
                  this.state.selectedAnnotationIds,
                  pageNumber
                );
                const selectedAnnotationSpanIds = selectors.annotationSpansInPage(
                  this.state.selectedAnnotationSpanIds,
                  pageNumber
                );
                const findFirstMatchEntityId =
                  this.state.symbolSearchEnabled &&
                  this.state.findMatchedEntities !== null &&
                  this.state.findMatchedEntities.length > 0 &&
                  selectors.entityIdsInPage(
                    [this.state.findMatchedEntities[0]],
                    entities,
                    pageNumber
                  ).length > 0
                    ? this.state.findMatchedEntities[0]
                    : null;
                const findMatchedEntityIds =
                  this.state.symbolSearchEnabled &&
                  this.state.isFindActive &&
                  this.state.findMatchedEntities !== null
                    ? selectors.entityIdsInPage(
                        this.state.findMatchedEntities,
                        entities,
                        pageNumber
                      )
                    : null;
                const findSelectionEntityId =
                  selectors.entityIdsInPage(
                    findMatchEntityId ? [findMatchEntityId] : [],
                    entities,
                    pageNumber
                  )[0] || null;
                const jumpTarget =
                  selectors.entityIdsInPage(
                    this.state.jumpTarget ? [this.state.jumpTarget] : [],
                    entities,
                    pageNumber
                  )[0] || null;

                const pageHasAnswerForHoveredFAQ =
                  entities.all
                    .map((id) => entities.byId[id])
                    .filter(isAnswerSentence)
                    .filter(
                      (s) =>
                        s.relationships.question.id == this.state.FAQHoveredID
                    ).length > 0;
                const FAQHoveredID = pageHasAnswerForHoveredFAQ
                  ? this.state.FAQHoveredID
                  : null;

                const pageHasAnswerForSelectedFAQ =
                  entities.all
                    .map((id) => entities.byId[id])
                    .filter(isAnswerSentence)
                    .filter(
                      (s) =>
                        s.relationships.question.id == this.state.selectedFAQID
                    ).length > 0;
                const selectedFAQID = pageHasAnswerForSelectedFAQ
                  ? this.state.selectedFAQID
                  : null;

                return (
                  <PageOverlay key={key} pageView={pageView}>
                    {/* Mask for highlighting results from in-situ search. */}
                    {!this.state.entityCreationEnabled &&
                    this.state.declutterEnabled &&
                    (this.state.findMode === "symbol" ||
                      this.state.findMode === "term") &&
                    findMatchedEntityIds !== null ? (
                      <SearchPageMask
                        pageView={pageView}
                        entities={entities}
                        firstMatchingEntityId={findFirstMatchEntityId}
                        matchingEntityIds={findMatchedEntityIds}
                        highlightFirstMatch={false}
                      />
                    ) : null}
                    {/* Mask for highlighting selected entities. */}
                    {!this.state.entityCreationEnabled &&
                    this.state.equationDiagramsEnabled &&
                    selectedEntityIds
                      .map((id) => entities.byId[id])
                      .filter((e) => e !== undefined)
                      .some(isEquation) ? (
                      <EntityPageMask
                        pageView={pageView}
                        entities={entities}
                        selectedEntityIds={selectedEntityIds}
                      />
                    ) : null}
                    {/* Interactive annotations on entities. */}
                    {this.state.entities !== null && (
                      <EntityAnnotationLayer
                        paperId={this.props.paperId}
                        pageView={pageView}
                        entities={entities}
                        lazyPapers={this.state.lazyPapers}
                        cachePaper={this.cachePaper}
                        selectedEntityIds={selectedEntityIds}
                        selectedAnnotationIds={selectedAnnotationIds}
                        selectedAnnotationSpanIds={selectedAnnotationSpanIds}
                        findMatchedEntityIds={findMatchedEntityIds}
                        findSelectionEntityId={findSelectionEntityId}
                        jumpTarget={jumpTarget}
                        showAnnotations={this.state.annotationHintsEnabled}
                        annotationInteractionEnabled={
                          this.state.annotationInteractionEnabled
                        }
                        showGlosses={this.state.glossesEnabled}
                        citationAnnotationsEnabled={
                          this.state.citationGlossesEnabled
                        }
                        termAnnotationsEnabled={this.state.termGlossesEnabled}
                        showHeaders={this.state.SectionHeadersEnabled}
                        showAnswers={this.state.FAQsEnabled}
                        symbolUnderlineMethod={this.state.symbolUnderlineMethod}
                        definitionsInSymbolGloss={
                          this.state.definitionsInSymbolGloss
                        }
                        glossStyle={this.state.glossStyle}
                        glossEvaluationEnabled={
                          this.state.glossEvaluationEnabled
                        }
                        equationDiagramsEnabled={
                          this.state.equationDiagramsEnabled
                        }
                        copySentenceOnClick={
                          this.state.sentenceTexCopyOnOptionClickEnabled
                        }
                        handleSelectEntityAnnotation={
                          this.selectEntityAnnotation
                        }
                        handleShowSnackbarMessage={this.showSnackbarMessage}
                        handleJumpToEntity={this.jumpToEntityWithBackMessage}
                        handleOpenDrawer={this.openDrawer}
                        FAQHoveredID={FAQHoveredID}
                        selectedFAQID={selectedFAQID}
                      />
                    )}
                    {/* Equation diagram overlays. */}
                    {this.state.equationDiagramsEnabled &&
                      selectedEntityIds
                        .map((id) => entities.byId[id])
                        .filter((e) => e !== undefined)
                        .filter(isEquation)
                        .map((e) => (
                          <EquationDiagram
                            key={`${e.id}-${this.state.useDefinitionsForDiagramLabels}`}
                            pageView={pageView}
                            entities={entities}
                            equation={e}
                            labelSource={
                              this.state.useDefinitionsForDiagramLabels
                                ? "any-definition"
                                : "only-diagram-labels"
                            }
                            handleShowMore={this.selectEntity}
                          />
                        ))}
                    {/* Canvas for annotating entities. */}
                    {this.state.entityCreationEnabled &&
                      this.state.entityCreationAreaSelectionMethod ===
                        "rectangular-selection" && (
                        <EntityCreationCanvas
                          pageView={pageView}
                          pageNumber={pageNumber}
                          entityType={this.state.entityCreationType}
                          handleShowSnackbarMessage={this.showSnackbarMessage}
                          handleCreateEntity={this.createEntity}
                        />
                      )}
                  </PageOverlay>
                );
              })}
            </>
          ) : null
        }
      </>
    );
  }

  private _backButtonHintShown: boolean = false;
  private _jumpedToInitialFocus: boolean = false;
}

async function waitForPDFViewerInitialization() {
  return new Promise<PDFViewerApplication>((resolve) => {
    const CHECK_CYCLE_MS = 50;
    function check() {
      if (
        window.PDFViewerApplication !== undefined &&
        window.PDFViewerApplication.initialized
      ) {
        resolve(window.PDFViewerApplication);
      } else {
        setTimeout(check, CHECK_CYCLE_MS);
      }
    }
    check();
  });
}
