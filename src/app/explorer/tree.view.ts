import { Node, NodeCategory, NodeSignal, ProjectNode } from './nodes'
import { ImmutableTree } from '@youwol/fv-tree'
import { children$, VirtualDOM } from '@youwol/flux-view'

/**
 * @category State
 */
export class TreeState extends ImmutableTree.State<Node> {
    constructor({ rootNode }: { rootNode: ProjectNode }) {
        super({
            rootNode,
            expandedNodes: [rootNode.id],
        })
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
            headerView: (treeState, node) =>
                new NodeView({ state: treeState, node }),
        })
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
        WorkspaceNode: '',
        ProjectNode: 'fas fa-project-diagram',
        SourceNode: 'fab fa-python',
        RequirementsNode: 'fas fa-cubes',
        ConfigurationsNode: 'fas fa-tools',
    }
    /**
     * @group Factories
     */
    static ProcessTypeFactory: Record<NodeSignal, string> = {
        loading: 'fas fa-cloud-download-alt fv-blink',
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
    public readonly class: string = 'd-flex align-items-center my-1 fv-pointer'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { state: TreeState; node: Node }) {
        Object.assign(this, params)
        this.children = [
            { class: `${NodeView.NodeTypeFactory[this.node.category]} mx-1` },
            { innerText: this.node.name },
            {
                children: children$(this.node.processes$, (processes) => {
                    return processes.map((process) => {
                        return {
                            class: `${
                                NodeView.ProcessTypeFactory[process.type]
                            } mx-1`,
                        }
                    })
                }),
            },
        ]
    }
}
