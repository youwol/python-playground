import {
    Node,
    NodeCategory,
    NodeSignal,
    ProjectNode,
    SourceNode,
} from './nodes'
import { ImmutableTree } from '@youwol/fv-tree'
import { child$, children$, HTMLElement$, VirtualDOM } from '@youwol/flux-view'
import { AppState } from '../app.state'
import { ContextMenuState } from './context-menu'
import { ContextMenu } from '@youwol/fv-context-menu'
import { filter } from 'rxjs/operators'

/**
 * @category State
 */
export class TreeState extends ImmutableTree.State<Node> {
    /**
     *
     * @group States
     */
    public readonly appState: AppState

    constructor({
        rootNode,
        appState,
    }: {
        rootNode: ProjectNode
        appState: AppState
    }) {
        super({
            rootNode,
            expandedNodes: [rootNode.id],
        })
        this.appState = appState
        this.selectedNode$.next(rootNode)
    }
}

/**
 * @category View
 */
export class TreeView extends ImmutableTree.View<Node> {
    constructor({ state }: { state: TreeState }) {
        super({
            state,
            headerView: (treeState: TreeState, node) =>
                new NodeView({ state: treeState, node }),
        })
        this.connectedCallback = (
            explorerDiv: HTMLElement$ & HTMLDivElement,
        ) => {
            const contextState = new ContextMenuState({
                appState: state.appState,
                explorerState: state,
                explorerDiv,
            })
            return new ContextMenu.View({
                state: contextState,
                class: 'fv-bg-background border fv-color-primary',
                style: {
                    zIndex: 20,
                },
            })
        }
    }
}

/**
 * @category View
 */
export class NodeView implements VirtualDOM {
    /**
     * @group Factories
     */
    static NodeTypeFactory: Record<NodeCategory, string> = {
        Node: '',
        ProjectNode: 'fas fa-project-diagram',
        SourceNode: 'fab fa-python',
        HelpersJsSourceNode: 'fab fa-js-square',
        RequirementsNode: 'fas fa-cubes',
        ConfigurationsNode: 'fas fa-tools',
        OutputViewNode: 'fas fa-code',
        WorkersPoolNode: 'fas fa-play',
    }
    /**
     * @group Factories
     */
    static ProcessTypeFactory: Record<NodeSignal, string> = {
        loading: 'fas fa-cloud-download-alt fv-blink',
        rename: '',
        saving: 'fas fa-save fv-blink',
        errorSaving: 'fas fa-save fv-text-error',
    }
    /**
     * @group States
     */
    public readonly state: TreeState

    /**
     * @group Immutable Constants
     */
    public readonly node: Node

    /**
     * @group Immutable DOM Constants
     */
    public readonly class: string =
        'w-100 d-flex align-items-center my-1 fv-pointer'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { state: TreeState; node: Node }) {
        Object.assign(this, params)
        const innerView = { innerText: this.node.name }

        this.children = [
            { class: `${NodeView.NodeTypeFactory[this.node.category]} mx-1` },
            child$(
                this.node.signal$.pipe(filter((signal) => signal == 'rename')),
                () => {
                    if (!(this.node instanceof SourceNode)) {
                        return innerView
                    }
                    return headerRenamed(this.node, this.state)
                },
                {
                    untilFirst: innerView,
                },
            ),
            {
                class: 'flex-grow-1',
            },
            {
                children: children$(this.node.processes$, (processes) => {
                    return processes.map((process) => {
                        return {
                            class: `${
                                NodeView.ProcessTypeFactory[process.type]
                            } mx-3`,
                        }
                    })
                }),
            },
        ]
    }
}

/**
 * Create renaming node's view
 *
 * @param node node to rename
 * @param explorerState explorer state
 * @returns the view
 *
 * @category View
 */
function headerRenamed(node: SourceNode, explorerState: TreeState): VirtualDOM {
    return {
        tag: 'input',
        type: 'text',
        autofocus: true,
        style: {
            zIndex: 200,
        },
        class: 'mx-2',
        data: node.name,
        onclick: (ev) => ev.stopPropagation(),
        onkeydown: (ev) => {
            if (ev.key === 'Enter') {
                explorerState.appState.renameFile(node, ev.target.value)
            }
        },
    }
}
