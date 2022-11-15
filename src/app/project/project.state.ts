import { Project } from '../models'
import { BehaviorSubject, merge, Observable, ReplaySubject } from 'rxjs'
import { scan } from 'rxjs/operators'
import { OutputViewNode } from '../explorer'
import { WorkerBaseState } from '../worker-base.state'

/**
 * @category State
 */
export class ProjectState extends WorkerBaseState {
    /**
     * @group Observables
     */
    public readonly project$: Observable<Project>

    /**
     * @group Observables
     */
    public readonly createdOutput$ = new ReplaySubject<OutputViewNode>(1)

    /**
     * @group Observables
     */
    public readonly createdOutputs$ = new BehaviorSubject<OutputViewNode[]>([])

    constructor({ project }: { project: Project }) {
        super({ worker: project })
        this.project$ = this.serialized$
        merge(this.runStart$, this.createdOutput$)
            .pipe(
                scan(
                    (acc, e: true | OutputViewNode) =>
                        e === true ? [] : [...acc, e],
                    [],
                ),
            )
            .subscribe((outputs) => {
                this.createdOutputs$.next(outputs)
            })
    }

    runCurrentConfiguration() {
        const outputs = {
            onLog: (log) => this.rawLog$.next(log),
            onView: (view) => {
                const newNode = new OutputViewNode({
                    ...view,
                    projectState: this,
                })
                this.createdOutput$.next(newNode)
            },
        }
        super.runCurrentConfiguration(outputs)
    }
}
