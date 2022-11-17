import { ImmutableTree } from '@youwol/fv-tree'
import { Environment, Project, WorkersPool } from '../models'
import { MainThreadState } from '../main-thread'
import { BehaviorSubject, ReplaySubject } from 'rxjs'
import { VirtualDOM } from '@youwol/flux-view'
import { EnvironmentState } from '../environment.state'
import { WorkersPoolState } from '../workers-pool'

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
    | 'WorkersPoolNode'
    | 'WorkerSourceNode'

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
    public readonly state: EnvironmentState

    constructor(params: { state: EnvironmentState }) {
        super({
            id: `${params.state.id}#requirements`,
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
    public readonly state: EnvironmentState

    constructor(params: { state: EnvironmentState }) {
        super({
            id: `${params.state.id}#configurations`,
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
    public readonly state: EnvironmentState

    constructor(params: { path: string; state: EnvironmentState }) {
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

    constructor(params: { path: string; state: EnvironmentState }) {
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
    public readonly state: MainThreadState

    /**
     * @group Immutable Constants
     */
    public readonly htmlElement: HTMLElement | VirtualDOM

    constructor(params: {
        projectState: MainThreadState
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
 * Predefined worker node
 *
 * @category Nodes
 */
export class WorkersPoolNode extends Node {
    /**
     * @group Immutable Constants
     */
    public readonly category: NodeCategory = 'WorkersPoolNode'

    /**
     * @group Immutable Constants
     */
    public readonly state: WorkersPoolState

    constructor(params: { pyWorker: WorkersPool; state: WorkersPoolState }) {
        super({
            id: params.pyWorker.id,
            name: params.pyWorker.name,
            children: [
                new RequirementsNode({
                    state: params.state,
                }),
                ...params.pyWorker.sources.map((source) => {
                    return new SourceNode({
                        path: source.path,
                        state: params.state,
                    })
                }),
            ],
        })
        Object.assign(this, params)
    }
}

export function createProjectRootNode(
    project: Project,
    projectState: MainThreadState,
    workersState: WorkersPoolState[],
) {
    const workersStateById = workersState.reduce(
        (acc, e) => ({ ...acc, [e.id]: e }),
        {},
    )
    return new ProjectNode({
        id: project.id,
        name: project.name,
        environment: project.environment,
        children: [
            new RequirementsNode({ state: projectState }),
            new ConfigurationsNode({ state: projectState }),
            ...(project.workersPools || []).map((pyWorker) => {
                return new WorkersPoolNode({
                    pyWorker,
                    state: workersStateById[pyWorker.id],
                })
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
                        state: projectState,
                    })
                }),
        ],
    })
}
