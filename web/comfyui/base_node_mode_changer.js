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
        this._lastModeCheckTime = 0;
        this._modeCheckInterval = 1000; // Check once per second - humans won't notice the delay
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
    onDrawForeground(ctx) {
        // Only check once per second to minimize overhead
        const now = Date.now();
        if (now - this._lastModeCheckTime < this._modeCheckInterval) {
            return;
        }
        this._lastModeCheckTime = now;
        
        // Check linked nodes for mode changes (e.g., from group bypass)
        const linkedNodes = getConnectedInputNodesAndFilterPassThroughs(this);
        if (!this.widgets || !linkedNodes) return;
        
        for (let i = 0; i < Math.min(this.widgets.length, linkedNodes.length); i++) {
            const widget = this.widgets[i];
            const linkedNode = linkedNodes[i];
            if (!linkedNode || !widget) continue;
            
            const expectedValue = linkedNode.mode === this.modeOn;
            if (widget.value !== expectedValue) {
                widget.value = expectedValue;
            }
        }
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
            }
        }
        if (this.widgets && this.widgets.length > linkedNodes.length) {
            this.widgets.length = linkedNodes.length;
            changed = true;
        }
        return changed;
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
