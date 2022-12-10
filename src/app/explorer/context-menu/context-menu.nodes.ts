import { ImmutableTree } from '@youwol/fv-tree'
import { TreeState } from '../tree.view'
import {
    ExecutingEnvironmentNode,
    ProjectNode,
    SourceNode,
    WorkersPoolNode,
} from '../nodes'
import { ContextMenuState } from './context-menu'
import { AbstractEnvImplementation } from '../../models'
/**
 * Factory of available actions in the
 * tree-view's context-menu
 */
export const ALL_ACTIONS = {
    newPyFile: {
        applicable: (selectedNode) =>
            selectedNode instanceof ExecutingEnvironmentNode,
        createNode: (documentNode: ProjectNode, explorerState: TreeState) =>
            new AddPyFileNode({
                parentNode: documentNode,
                explorerState,
            }),
    },
    newJsFile: {
        applicable: (selectedNode) =>
            selectedNode instanceof ExecutingEnvironmentNode,
        createNode: (documentNode: ProjectNode, explorerState: TreeState) =>
            new AddJsFileNode({
                parentNode: documentNode,
                explorerState,
            }),
    },
    deleteFile: {
        applicable: (selectedNode) => selectedNode instanceof SourceNode,
        createNode: (deletedNode: SourceNode, explorerState: TreeState) =>
            new DeleteFileNode({
                deletedNode,
                explorerState,
            }),
    },
    renameFileNode: {
        applicable: (selectedNode) => selectedNode instanceof SourceNode,
        createNode: (node: SourceNode, explorerState: TreeState) =>
            new RenameNode<SourceNode>({
                node,
                explorerState,
            }),
    },
    newWorker: {
        applicable: (selectedNode) => selectedNode instanceof ProjectNode,
        createNode: (node: ProjectNode, explorerState: TreeState) =>
            new NewWorkersPoolNode({
                node,
                explorerState,
            }),
    },
    deleteWorker: {
        applicable: (selectedNode) => selectedNode instanceof WorkersPoolNode,
        createNode: (node: WorkersPoolNode, explorerState: TreeState) =>
            new DeleteWorkersPoolNode({
                node,
                explorerState,
            }),
    },
}

export interface ExecutableNode {
    execute(state: ContextMenuState)
}

export class ContextTreeNode extends ImmutableTree.Node {
    public readonly faIcon
    public readonly name

    constructor({
        id,
        children,
        name,
        faIcon,
    }: {
        id: string
        children: Array<ContextTreeNode>
        name: string
        faIcon: string
    }) {
        super({ id, children })
        this.name = name
        this.faIcon = faIcon
    }
}

export function isExecutable(
    node: ExecutableNode | ContextTreeNode,
): node is ExecutableNode {
    return (node as unknown as ExecutableNode).execute !== undefined
}

export class ContextRootNode extends ContextTreeNode {
    constructor({ children }: { children: Array<ContextTreeNode> }) {
        super({ id: 'root', children, name: 'menu list', faIcon: '' })
    }
}

export class AddPyFileNode extends ContextTreeNode implements ExecutableNode {
    public readonly explorerState: TreeState
    public readonly parentNode: ExecutingEnvironmentNode<AbstractEnvImplementation>

    constructor(params: {
        explorerState: TreeState
        parentNode: ExecutingEnvironmentNode<AbstractEnvImplementation>
    }) {
        super({
            id: 'new-python-file',
            children: undefined,
            name: 'New python file',
            faIcon: 'fab fa-python',
        })
        Object.assign(this, params)
    }

    execute(_state: ContextMenuState) {
        this.explorerState.appState.addFile(
            this.parentNode.state,
            'new_file',
            'py',
        )
    }
}

export class AddJsFileNode extends ContextTreeNode implements ExecutableNode {
    public readonly explorerState: TreeState
    public readonly parentNode: ExecutingEnvironmentNode<AbstractEnvImplementation>

    constructor(params: {
        explorerState: TreeState
        parentNode: ExecutingEnvironmentNode<AbstractEnvImplementation>
    }) {
        super({
            id: 'new-javascript-file',
            children: undefined,
            name: 'New javascript file',
            faIcon: 'fab fa-js-square',
        })
        Object.assign(this, params)
    }

    execute(_state: ContextMenuState) {
        this.explorerState.appState.addFile(
            this.parentNode.state,
            'new_file',
            'js',
        )
    }
}

export class RenameNode<TNode extends SourceNode>
    extends ContextTreeNode
    implements ExecutableNode
{
    public readonly node: TNode

    constructor(params: { explorerState: TreeState; node: TNode }) {
        super({
            id: 'rename',
            children: undefined,
            name: 'Rename',
            faIcon: 'fas fa-pen',
        })
        Object.assign(this, params)
    }

    execute(_state: ContextMenuState) {
        this.node.signal$.next('rename')
    }
}

export class DeleteFileNode extends ContextTreeNode implements ExecutableNode {
    public readonly explorerState: TreeState
    public readonly deletedNode: SourceNode

    constructor(params: { explorerState: TreeState; deletedNode: SourceNode }) {
        super({
            id: 'delete-document',
            children: undefined,
            name: 'Delete',
            faIcon: 'fas fa-trash',
        })
        Object.assign(this, params)
    }

    execute(_state: ContextMenuState) {
        this.explorerState.appState.deleteFile(
            this.deletedNode.state,
            this.deletedNode.path,
        )
    }
}

export class NewWorkersPoolNode
    extends ContextTreeNode
    implements ExecutableNode
{
    public readonly explorerState: TreeState
    public readonly node: ProjectNode

    constructor(params: { explorerState: TreeState; node: ProjectNode }) {
        super({
            id: 'new-workers-pool',
            children: undefined,
            name: 'New workers pool',
            faIcon: 'fas fa-play',
        })
        Object.assign(this, params)
    }

    execute(_state: ContextMenuState) {
        this.explorerState.appState.addWorkersPool()
    }
}

export class DeleteWorkersPoolNode
    extends ContextTreeNode
    implements ExecutableNode
{
    public readonly explorerState: TreeState
    public readonly node: WorkersPoolNode

    constructor(params: { explorerState: TreeState; node: WorkersPoolNode }) {
        super({
            id: 'delete-workers-pool',
            children: undefined,
            name: 'Delete workers pool',
            faIcon: 'fas fa-trash',
        })
        Object.assign(this, params)
    }

    execute(_state: ContextMenuState) {
        this.explorerState.appState.deleteWorkersPool(this.node.state)
    }
}
