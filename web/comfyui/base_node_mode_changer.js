import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";
import { changeModeOfNodes, PassThroughFollowing, getConnectedInputNodesAndFilterPassThroughs } from "./utils.js";
import { wait } from "../../rgthree/common/shared_utils.js";
export class BaseNodeModeChanger extends BaseAnyInputConnectedNode {
    constructor(title) {
        super(title);
        this.inputsPassThroughFollowing = PassThroughFollowing.ALL;
        this.isVirtualNode = true;
        this.modeOn = -1;
        this.modeOff = -1;
        this.properties["toggleRestriction"] = "default";
    }
    onConstructed() {
        wait(10).then(() => {
            if (this.modeOn < 0 || this.modeOff < 0) {
                throw new Error("modeOn and modeOff must be overridden.");
            }
        });
        this.addOutput("OPT_CONNECTION", "*");
        return super.onConstructed();
    }
    handleLinkedNodesStabilization(linkedNodes) {
        let changed = false;
        for (const [index, node] of linkedNodes.entries()) {
            let widget = this.widgets && this.widgets[index];
            if (!widget) {
                this._tempWidth = this.size[0];
                widget = this.addWidget("toggle", "", false, "", { on: "yes", off: "no" });
                changed = true;
            }
            if (node) {
                changed = this.setWidget(widget, node) || changed;
                // Hook into the node's mode property to detect changes
                this._setupModeChangeHook(node, widget, index);
            }
        }
        if (this.widgets && this.widgets.length > linkedNodes.length) {
            this.widgets.length = linkedNodes.length;
            changed = true;
        }
        return changed;
    }
    _setupModeChangeHook(linkedNode, widget, index) {
        // Skip if already hooked
        if (linkedNode._rgthreeModeHooked) return;
        
        // Store original mode value
        let currentMode = linkedNode.mode;
        
        // Override mode property with getter/setter
        Object.defineProperty(linkedNode, 'mode', {
            get() {
                return currentMode;
            },
            set(newMode) {
                const oldMode = currentMode;
                currentMode = newMode;
                
                // Call the node's onModeChange callback if it exists (for repeaters/relays)
                if (oldMode !== newMode && typeof linkedNode.onModeChange === 'function') {
                    linkedNode.onModeChange(oldMode, newMode);
                }
                
                // Notify all Fast Bypasser/Muter nodes watching this node
                if (oldMode !== newMode && linkedNode._rgthreeModeWatchers) {
                    for (const watcher of linkedNode._rgthreeModeWatchers) {
                        watcher.onLinkedNodeModeChanged(linkedNode, newMode);
                    }
                }
            },
            configurable: true,
            enumerable: true
        });
        
        linkedNode._rgthreeModeHooked = true;
        
        // Register this node as a watcher
        if (!linkedNode._rgthreeModeWatchers) {
            linkedNode._rgthreeModeWatchers = [];
        }
        if (!linkedNode._rgthreeModeWatchers.includes(this)) {
            linkedNode._rgthreeModeWatchers.push(this);
        }
    }
    onLinkedNodeModeChanged(linkedNode, newMode) {
        // Find the widget for this linked node and update it immediately
        const linkedNodes = getConnectedInputNodesAndFilterPassThroughs(this);
        const index = linkedNodes.indexOf(linkedNode);
        
        if (index >= 0 && this.widgets && this.widgets[index]) {
            const widget = this.widgets[index];
            const expectedValue = newMode === this.modeOn;
            if (widget.value !== expectedValue) {
                widget.value = expectedValue;
                this.setDirtyCanvas(true, false);
            }
        }
    }
    setWidget(widget, linkedNode, forceValue) {
        let changed = false;
        const value = forceValue == null ? linkedNode.mode === this.modeOn : forceValue;
        let name = `Enable ${linkedNode.title}`;
        if (widget.name !== name) {
            widget.name = `Enable ${linkedNode.title}`;
            widget.options = { on: "yes", off: "no" };
            widget.value = value;
            widget.doModeChange = (forceValue, skipOtherNodeCheck) => {
                var _a, _b, _c;
                let newValue = forceValue == null ? linkedNode.mode === this.modeOff : forceValue;
                if (skipOtherNodeCheck !== true) {
                    if (newValue && ((_b = (_a = this.properties) === null || _a === void 0 ? void 0 : _a["toggleRestriction"]) === null || _b === void 0 ? void 0 : _b.includes(" one"))) {
                        for (const widget of this.widgets) {
                            widget.doModeChange(false, true);
                        }
                    }
                    else if (!newValue && ((_c = this.properties) === null || _c === void 0 ? void 0 : _c["toggleRestriction"]) === "always one") {
                        newValue = this.widgets.every((w) => !w.value || w === widget);
                    }
                }
                changeModeOfNodes(linkedNode, (newValue ? this.modeOn : this.modeOff));
                widget.value = newValue;
            };
            widget.callback = () => {
                widget.doModeChange();
            };
            changed = true;
        }
        if (forceValue != null) {
            const newMode = (forceValue ? this.modeOn : this.modeOff);
            if (linkedNode.mode !== newMode) {
                changeModeOfNodes(linkedNode, newMode);
                changed = true;
            }
        }
        return changed;
    }
    forceWidgetOff(widget, skipOtherNodeCheck) {
        widget.doModeChange(false, skipOtherNodeCheck);
    }
    forceWidgetOn(widget, skipOtherNodeCheck) {
        widget.doModeChange(true, skipOtherNodeCheck);
    }
    forceWidgetToggle(widget, skipOtherNodeCheck) {
        widget.doModeChange(!widget.value, skipOtherNodeCheck);
    }
}
BaseNodeModeChanger.collapsible = false;
BaseNodeModeChanger["@toggleRestriction"] = {
    type: "combo",
    values: ["default", "max one", "always one"],
};
