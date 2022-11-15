import { ImmutableTree } from '@youwol/fv-tree'
import {
    Environment,
    Project,
    PyWorker,
    WorkerInput$,
    WorkerOutput$,
} from '../models'
import { ProjectState } from '../project'
import { BehaviorSubject, ReplaySubject } from 'rxjs'
import { VirtualDOM } from '@youwol/flux-view'

/**
 * Node's signal data-structure
 */
export type NodeSignal = 'loading' | 'saving' | 'rename' | 'errorSaving'

export type NodeCategory =
    | 'Node'
    | 'ProjectNode'
    | 'RequirementsNode'
    | 'ConfigurationsNode'
    | 'HelpersJsSourceNode'
    | 'SourceNode'
    | 'OutputViewNode'
    | 'WorkerRequirementsNode'
    | 'PyWorkerNode'
    | 'WorkerSourceNode'
    | 'WorkerIONode'
    | 'WorkerInputsNode'
    | 'WorkerOutputsNode'

export const specialFiles = ['./requirements', './configurations']
/**
 * Base class of workspace explorer
 *
 * @category Nodes
 */
export abstract class Node extends ImmutableTree.Node {
    /**
     * @group Observables
     */
    public readonly processes$ = new BehaviorSubject<
        { id: string; type: NodeSignal }[]
    >([])

    /**
     * @group Observables
     */
    public readonly signal$ = new ReplaySubject<NodeSignal>(1)

    /**
     * @group Immutable Constants
     */
    public readonly name: string

    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'Node'

    protected constructor({
        id,
        name,
        children,
    }: {
        id: string
        name: string
        children?: Node[]
    }) {
        super({ id, children })
        this.name = name
    }

    addProcess(process: { type: NodeSignal; id?: string }) {
        const pid = process.id || `${Math.floor(Math.random() * 1e6)}`
        const runningProcesses = this.processes$
            .getValue()
            .filter((p) => p.id != pid)
        this.processes$.next([
            ...runningProcesses,
            { id: pid, type: process.type },
        ])
        return pid
    }

    removeProcess(id: string) {
        this.processes$.next(
            this.processes$.getValue().filter((p) => p.id != id),
        )
    }
}

/**
 * Project Node of explorer
 *
 * @category Nodes
 */
export class ProjectNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'ProjectNode'

    /**
     * @group Immutable Constants
     */
    public readonly environment: Environment

    constructor(params: {
        id: string
        name: string
        environment: Environment
        children
    }) {
        super({
            id: params.id,
            name: params.name,
            children: params.children,
        })
        Object.assign(this, params)
    }
}

/**
 * Requirement Node of explorer
 *
 * @category Nodes
 */
export class RequirementsNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'RequirementsNode'

    /**
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    constructor(params: { projectState: ProjectState }) {
        super({
            id: `${params.projectState.id}#requirements`,
            name: 'Requirements',
        })
        Object.assign(this, params)
    }
}

/**
 * Requirement Node of explorer
 *
 * @category Nodes
 */
export class ConfigurationsNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'ConfigurationsNode'

    /**
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    constructor(params: { projectState: ProjectState }) {
        super({
            id: `${params.projectState.id}#configurations`,
            name: 'Configurations',
        })
        Object.assign(this, params)
    }
}

/**
 * Source Node of explorer
 *
 * @category Nodes
 */
export class SourceNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'SourceNode'

    /**
     * @group Immutable Constants
     */
    public readonly path: string

    /**
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    constructor(params: { path: string; projectState: ProjectState }) {
        super({
            id: params.path,
            name: params.path.split('/').slice(-1)[0],
            children: undefined,
        })
        Object.assign(this, params)
    }
}

/**
 * Requirement Node of explorer
 *
 * @category Nodes
 */
export class HelpersJsSourceNode extends SourceNode {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'HelpersJsSourceNode'

    constructor(params: { path: string; projectState: ProjectState }) {
        super(params)
    }
}

/**
 * Folder of output views Node of explorer
 *
 * @category Nodes
 */
export class OutputViewNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'OutputViewNode'

    /**
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable Constants
     */
    public readonly htmlElement: HTMLElement | VirtualDOM

    constructor(params: {
        projectState: ProjectState
        name: string
        htmlElement: HTMLElement | VirtualDOM
    }) {
        super({
            id: `${params.projectState.id}.folder-views.${params.name}`,
            name: params.name,
        })
        Object.assign(this, params)
    }
}

/**
 * Requirement Node of explorer for worker
 *
 * @category Nodes
 */
export class WorkerRequirementsNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'WorkerRequirementsNode'

    /**
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable Constants
     */
    public readonly workerId: string

    constructor(params: { workerId: string; projectState: ProjectState }) {
        super({
            id: `${params.projectState.id}#${params.workerId}#requirements`,
            name: 'Requirements',
        })
        Object.assign(this, params)
    }
}

export class WorkerIONode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'WorkerIONode'

    /**
     * @group Immutable Constants
     */
    public readonly name: string

    /**
     * @group Immutable Constants
     */
    public readonly type: string

    constructor(params: {
        workerId: string
        name: string
        type: 'input' | 'output'
        projectState: ProjectState
    }) {
        super({
            id: `${params.workerId}#${params.name}`,
            name: params.name,
            children: undefined,
        })
        Object.assign(this, params)
    }
}

export class WorkerInputsNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'WorkerInputsNode'

    constructor(params: {
        inputs: WorkerInput$[]
        workerId: string
        projectState: ProjectState
    }) {
        super({
            id: `${params.workerId}#inputs`,
            name: 'Inputs',
            children: params.inputs.map((input) => {
                return new WorkerIONode({
                    workerId: params.workerId,
                    name: input.name,
                    type: 'input',
                    projectState: params.projectState,
                })
            }),
        })
        Object.assign(this, params)
    }
}

export class WorkerOutputsNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'WorkerOutputsNode'

    constructor(params: {
        outputs: WorkerOutput$[]
        workerId: string
        projectState: ProjectState
    }) {
        super({
            id: `${params.workerId}#outputs`,
            name: 'Outputs',
            children: params.outputs.map((input) => {
                return new WorkerIONode({
                    workerId: params.workerId,
                    name: input.name,
                    type: 'output',
                    projectState: params.projectState,
                })
            }),
        })
        Object.assign(this, params)
    }
}

/**
 * Source Node of a worker
 *
 * @category Nodes
 */
export class WorkerSourceNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'WorkerSourceNode'

    /**
     * @group Immutable Constants
     */
    public readonly path: string

    /**
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable Constants
     */
    public readonly workerId: string

    constructor(params: {
        workerId: string
        path: string
        projectState: ProjectState
    }) {
        super({
            id: params.path,
            name: params.path.split('/').slice(-1)[0],
            children: undefined,
        })
        Object.assign(this, params)
    }
}

/**
 * Predefined worker node
 *
 * @category Nodes
 */
export class PyWorkerNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'PyWorkerNode'

    /**
     * @group Immutable Constants
     */
    public readonly pyWorker: PyWorker

    /**
     * @group Immutable Constants
     */
    public readonly projectState: ProjectState

    constructor(params: { pyWorker: PyWorker; projectState: ProjectState }) {
        super({
            id: params.pyWorker.id,
            name: params.pyWorker.name,
            children: [
                new WorkerRequirementsNode({
                    projectState: params.projectState,
                    workerId: params.pyWorker.id,
                }),
                ...params.pyWorker.sources.map((source) => {
                    return new WorkerSourceNode({
                        workerId: params.pyWorker.id,
                        path: source.path,
                        projectState: params.projectState,
                    })
                }),
                new WorkerInputsNode({
                    workerId: params.pyWorker.id,
                    inputs: params.pyWorker.inputs,
                    projectState: params.projectState,
                }),
                new WorkerOutputsNode({
                    workerId: params.pyWorker.id,
                    outputs: params.pyWorker.outputs,
                    projectState: params.projectState,
                }),
            ],
        })
        Object.assign(this, params)
    }
}

export function createProjectRootNode(
    project: Project,
    projectState: ProjectState,
) {
    return new ProjectNode({
        id: project.id,
        name: project.name,
        environment: project.environment,
        children: [
            new RequirementsNode({ projectState }),
            new ConfigurationsNode({ projectState }),
            ...(project.pyWorkers || []).map((pyWorker) => {
                return new PyWorkerNode({ pyWorker, projectState })
            }),
            ...project.sources
                .filter((source) => {
                    return !specialFiles.includes(source.path)
                })
                .map((source) => {
                    const factory = source.path.endsWith('.py')
                        ? SourceNode
                        : HelpersJsSourceNode
                    return new factory({
                        path: source.path,
                        projectState,
                    })
                }),
        ],
    })
}
