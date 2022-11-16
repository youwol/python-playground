/** @format */

import { Observable, of, Subject } from 'rxjs'
import { filter, map, reduce, take, takeWhile, tap } from 'rxjs/operators'
import { Context } from '../context'

type WorkerId = string

interface WorkerDependency {
    id: string
    src: string
    import?: (GlobalScope, src) => void
    sideEffects?: (globalScope, exports) => void
}

interface WorkerFunction<T> {
    id: string
    target: T
}

interface WorkerVariable<T> {
    id: string
    value: T
}

export interface WorkerContext {
    info: (text: string, data?: unknown) => void
    sendData: (data: Record<string, unknown>) => void
}

interface MessageDataExecute {
    taskId: string
    workerId: string
    entryPoint: string
    args: unknown
}

type MessageDataVariables = WorkerVariable<unknown>[]

type MessageDataFunctions = WorkerFunction<string>[]

interface MessageDataScript {
    import: string
    id: string
    src: string
    sideEffects: string
}

interface MessageDataExit {
    taskId: string
    error: boolean
    result: unknown
}

interface MessageDataLog {
    taskId: string
    text: string
    json: unknown // Json
}

export interface MessageDataData {
    taskId: string
    workerId: string
    [k: string]: unknown
}

export interface MessageEventData {
    type:
        | 'Execute'
        | 'installVariables'
        | 'installFunctions'
        | 'installScript'
        | 'Exit'
        | 'Start'
        | 'Log'
        | 'DependencyInstalled'
        | 'Data'
    data:
        | MessageDataExecute
        | MessageDataVariables
        | MessageDataFunctions
        | MessageDataData
}

export interface EntryPointArguments<TArgs> {
    args: TArgs
    taskId: string
    context: WorkerContext
    workerScope
}

function entryPointWorker(messageEvent: MessageEvent) {
    const message: MessageEventData = messageEvent.data
    const workerScope = self
    workerScope['window'] = self
    if (message.type == 'Execute') {
        const data: MessageDataExecute =
            message.data as unknown as MessageDataExecute
        const context: WorkerContext = {
            info: (text, json) => {
                workerScope.postMessage({
                    type: 'Log',
                    data: {
                        taskId: data.taskId,
                        workerId: data.workerId,
                        logLevel: 'info',
                        text,
                        json: json,
                    },
                })
            },
            sendData: (consumerData) => {
                workerScope.postMessage({
                    type: 'Data',
                    data: {
                        ...consumerData,
                        ...{ taskId: data.taskId, workerId: data.workerId },
                    },
                })
            },
        }

        const entryPoint = new Function(data.entryPoint)()

        workerScope.postMessage({
            type: 'Start',
            data: {
                taskId: data.taskId,
                workerId: data.workerId,
            },
        })
        try {
            const resultOrPromise = entryPoint({
                args: data.args,
                taskId: data.taskId,
                workerScope: workerScope,
                context,
            })
            if (resultOrPromise instanceof Promise) {
                resultOrPromise
                    .then((result) => {
                        workerScope.postMessage({
                            type: 'Exit',
                            data: {
                                taskId: data.taskId,
                                workerId: data.workerId,
                                error: false,
                                result: result,
                            },
                        })
                    })
                    .catch((error) => {
                        workerScope.postMessage({
                            type: 'Exit',
                            data: {
                                taskId: data.taskId,
                                workerId: data.workerId,
                                error: true,
                                result: error,
                            },
                        })
                    })
                return
            }

            workerScope.postMessage({
                type: 'Exit',
                data: {
                    taskId: data.taskId,
                    workerId: data.workerId,
                    error: false,
                    result: resultOrPromise,
                },
            })
        } catch (e) {
            workerScope.postMessage({
                type: 'Exit',
                data: {
                    taskId: data.taskId,
                    workerId: data.workerId,
                    error: true,
                    result: e,
                },
            })
            return
        }
    }
    if (message.type == 'installVariables') {
        const data: MessageDataVariables =
            message.data as unknown as MessageDataVariables
        data.forEach((d) => {
            workerScope[d.id] = d.value
        })
    }
    if (message.type == 'installFunctions') {
        const data: MessageDataFunctions =
            message.data as unknown as MessageDataFunctions
        data.forEach((d) => {
            workerScope[d.id] = new Function(d.target)()
        })
    }
    if (message.type == 'installScript') {
        //let GlobalScope = _GlobalScope ? _GlobalScope : self as any
        const data: MessageDataScript =
            message.data as unknown as MessageDataScript
        const GlobalScope = self
        const exports = {}
        if (!data.import) {
            workerScope.postMessage({
                type: 'Log',
                data: {
                    logLevel: 'info',
                    text: `Installing ${data.id} using default import`,
                },
            })
            new Function('document', 'exports', '__dirname', data.src)(
                GlobalScope,
                exports,
                '',
            )
        } else {
            workerScope.postMessage({
                type: 'Log',
                data: {
                    logLevel: 'info',
                    text: `Installing ${data.id} using provided import function: ${data.import}`,
                },
            })
            const importFunction = new Function(data.import)()
            importFunction(GlobalScope, data.src)
        }
        workerScope.postMessage({
            type: 'Log',
            data: {
                logLevel: 'info',
                text: `Installing ${data.id} using provided import function: ${data.import}`,
            },
        })

        if (data.sideEffects) {
            const sideEffectFunction = new Function(data.sideEffects)()
            const promise = sideEffectFunction(GlobalScope, exports)
            if (promise instanceof Promise) {
                promise.then(() => {
                    workerScope.postMessage({
                        type: 'DependencyInstalled',
                        data: {
                            id: data.id,
                        },
                    })
                })
            } else {
                workerScope.postMessage({
                    type: 'DependencyInstalled',
                    data: {
                        id: data.id,
                    },
                })
            }
        } else {
            workerScope.postMessage({
                type: 'DependencyInstalled',
                data: {
                    id: data.id,
                },
            })
        }
    }
}

export class Process {
    public readonly taskId: string
    public readonly title: string
    public readonly context: Context

    constructor(params: { taskId: string; title: string; context: Context }) {
        Object.assign(this, params)
    }

    schedule() {
        console.log('Schedule Process', {
            taskId: this.taskId,
            title: this.title,
        })
    }

    start() {
        console.log('Start Process', { taskId: this.taskId, title: this.title })
    }

    fail(error: unknown) {
        console.log('Failed Process', {
            taskId: this.taskId,
            title: this.title,
            error,
        })
    }

    succeed() {
        console.log('Succeeded Process', {
            taskId: this.taskId,
            title: this.title,
        })
    }

    log(text: string) {
        console.log('Process Log', {
            taskId: this.taskId,
            title: this.title,
            text,
        })
    }
}

export class WorkerPool {
    poolSize = navigator.hardwareConcurrency - 2

    workers: { [key: string]: Worker } = {}
    channels$: { [key: string]: Subject<MessageEventData> } = {}
    installedDependencies: { [key: string]: Array<string> } = {}

    tasksQueue: Array<{
        taskId: string
        targetWorkerId?: string
        args: unknown
        channel$: Subject<MessageEventData>
        entryPoint: unknown
    }> = []
    runningTasks: Array<{ workerId: string; taskId: string }> = []
    busyWorkers: Array<string> = []

    dependencies: WorkerDependency[] = []
    functions: WorkerFunction<unknown>[] = []
    variables: WorkerVariable<unknown>[] = []

    workerReleased$ = new Subject<{ workerId: WorkerId; taskId: string }>()

    backgroundContext = new Context('background management', {})

    constructor() {
        // Need to manage lifecycle of following subscription
        this.workerReleased$.subscribe(({ workerId, taskId }) => {
            this.busyWorkers = this.busyWorkers.filter((wId) => wId != workerId)
            this.runningTasks = this.runningTasks.filter(
                (task) => task.taskId != taskId,
            )

            this.pickTask(workerId, this.backgroundContext)
        })
    }

    schedule<TArgs = unknown>({
        title,
        entryPoint,
        args,
        targetWorkerId,
        context,
    }: {
        title: string
        entryPoint: (input: EntryPointArguments<TArgs>) => void
        args: TArgs
        targetWorkerId?: string
        context: Context
    }): Observable<MessageEventData> {
        return context.withChild('schedule thread', (ctx) => {
            const taskId = `t${Math.floor(Math.random() * 1e6)}`
            const channel$ = new Subject<MessageEventData>()
            const p = new Process({
                taskId,
                title,
                context: ctx,
            })
            p.schedule()

            const r$ = this.instrumentChannel$(channel$, p, taskId, context)

            if (targetWorkerId && !this.workers[targetWorkerId]) {
                throw Error('Provided workerId not known')
            }
            if (targetWorkerId && this.workers[targetWorkerId]) {
                this.tasksQueue.push({
                    entryPoint,
                    args,
                    taskId,
                    channel$,
                    targetWorkerId,
                })

                if (!this.busyWorkers.includes(targetWorkerId)) {
                    this.pickTask(targetWorkerId, ctx)
                }

                return r$
            }
            const worker$ = this.getWorker$(ctx)
            if (!worker$) {
                this.tasksQueue.push({
                    entryPoint,
                    args,
                    taskId,
                    channel$,
                })
                return r$
            }
            worker$
                .pipe(
                    map(({ workerId }) => {
                        ctx.info(`Got a worker ready ${workerId}`, {
                            installedDependencies:
                                this.installedDependencies[workerId],
                            requiredDependencies: this.dependencies.map(
                                (d) => d.id,
                            ),
                        })
                        this.tasksQueue.push({
                            entryPoint,
                            args,
                            taskId,
                            channel$,
                        })
                        this.pickTask(workerId, ctx)
                        return workerId
                    }),
                )
                .subscribe()

            return r$
        })
    }

    import({
        sources,
        functions,
        variables,
    }: {
        sources: WorkerDependency[]
        functions: WorkerFunction<unknown>[]
        variables: WorkerVariable<unknown>[]
    }) {
        this.dependencies = [...this.dependencies, ...sources]
        this.functions = [...this.functions, ...functions]
        this.variables = [...this.variables, ...variables]
        Object.values(this.workers).forEach((worker) =>
            this.installDependencies(worker, sources, functions, variables),
        )
    }

    installDependencies(worker, sources, functions, variables) {
        worker.postMessage({
            type: 'installVariables',
            data: variables,
        })

        const dataFcts = functions.map((fct) => ({
            id: fct.id,
            target: `return ${String(fct.target)}`,
        }))
        worker.postMessage({
            type: 'installFunctions',
            data: dataFcts,
        })

        sources.forEach((dependency) => {
            worker.postMessage({
                type: 'installScript',
                data: {
                    src: dependency.src,
                    id: dependency.id,
                    import: dependency.import
                        ? `return ${String(dependency.import)}`
                        : undefined,
                    sideEffects: dependency.sideEffects
                        ? `return ${String(dependency.sideEffects)}`
                        : undefined,
                },
            })
        })
    }

    instrumentChannel$(
        originalChannel$: Subject<MessageEventData>,
        exposedProcess: Process,
        taskId: string,
        context: Context,
    ): Observable<MessageEventData> {
        const channel$ = originalChannel$.pipe(
            takeWhile((message) => message.type != 'Exit', true),
        )

        channel$
            .pipe(
                filter((message) => message.type == 'Start'),
                take(1),
            )
            .subscribe((message) => {
                context.info('worker started', message)
                exposedProcess.start()
            })

        channel$
            .pipe(
                filter((message) => message.type == 'Exit'),
                take(1),
            )
            .subscribe((message) => {
                const data = message.data as unknown as MessageDataExit
                if (data.error) {
                    context.info('worker exited abnormally', message)
                    exposedProcess.fail(data.result)
                    return
                }
                exposedProcess.succeed()
                context.info('worker exited normally', message)
            })

        /*channel$
            .pipe(filter((message) => message.data.taskId != taskId))
            .subscribe((message: any) => {
                throw Error(
                    `Mismatch in taskId: expected ${taskId} but got from message ${message.data.taskId}`,
                )
            })*/

        channel$
            .pipe(filter((message) => message.type == 'Log'))
            .subscribe((message) => {
                const data = message.data as unknown as MessageDataLog
                exposedProcess.log(data.text)
                context.info(data.text, data.json)
            })

        return channel$.pipe(
            map((message) => {
                const exitData = message.data as unknown as MessageDataExit
                if (message.type == 'Exit' && exitData.error) {
                    throw Error(String(exitData.result))
                }
                return message
            }),
        )
    }

    getWorker$(
        context: Context,
    ): Observable<{ workerId: string; worker: Worker }> {
        return context.withChild('get worker', (ctx) => {
            const idleWorkerId = Object.keys(this.workers).find(
                (workerId) => !this.busyWorkers.includes(workerId),
            )

            if (idleWorkerId) {
                ctx.info(`return idle worker ${idleWorkerId}`)
                return of({
                    workerId: idleWorkerId,
                    worker: this.workers[idleWorkerId],
                })
            }
            if (Object.keys(this.workers).length < this.poolSize) {
                return this.createWorker$(ctx)
            }
            return undefined
        })
    }

    createWorker$(
        context: Context,
    ): Observable<{ workerId: string; worker: Worker }> {
        return context.withChild('create worker', (ctx) => {
            const workerId = `w${Math.floor(Math.random() * 1e6)}`
            ctx.info(`Create worker ${workerId}`, {
                requiredDependencies: this.dependencies.map((d) => d.id),
            })

            this.channels$[workerId] = new Subject()

            const blob = new Blob(
                ['self.onmessage = ', entryPointWorker.toString()],
                { type: 'text/javascript' },
            )
            const url = URL.createObjectURL(blob)
            const worker = new Worker(url)
            this.installedDependencies[workerId] = []

            worker.onmessage = ({ data }) => {
                if (data.type == 'DependencyInstalled') {
                    this.installedDependencies[workerId].push(data.id)
                    this.channels$[workerId].next(data)
                }
            }

            this.installDependencies(
                worker,
                this.dependencies,
                this.functions,
                this.variables,
            )

            const dependencyCount = Object.keys(this.dependencies).length
            if (dependencyCount == 0) {
                ctx.info('No dependencies to load: worker ready', {
                    workerId: workerId,
                    worker,
                })
                this.workers[workerId] = worker
                return of({ workerId, worker })
            }
            return this.channels$[workerId].pipe(
                filter((message) => message.type == 'DependencyInstalled'),
                take(dependencyCount),
                reduce((acc, e) => {
                    return acc.concat(e)
                }, []),
                map(() => worker),
                tap(() => (this.workers[workerId] = worker)),
                map((worker) => {
                    return { workerId, worker }
                }),
            )
        })
    }

    /**
     * Start a worker with first task in its queue
     */
    pickTask(workerId: string, context: Context) {
        context.withChild('pickTask', (ctx) => {
            if (
                this.tasksQueue.filter(
                    (task) =>
                        task.targetWorkerId == undefined ||
                        task.targetWorkerId == workerId,
                ).length == 0
            ) {
                return
            }
            this.busyWorkers.push(workerId)
            const { taskId, entryPoint, args, channel$ } = this.tasksQueue.find(
                (t) =>
                    t.targetWorkerId ? t.targetWorkerId === workerId : true,
            )

            this.tasksQueue = this.tasksQueue.filter((t) => t.taskId != taskId)

            this.runningTasks.push({ workerId, taskId })
            const worker = this.workers[workerId]

            channel$
                .pipe(
                    filter((message) => {
                        return message.type == 'Exit'
                    }),
                )
                .subscribe((message) => {
                    const exitData = message.data as unknown as MessageDataExit
                    this.workerReleased$.next({
                        taskId: exitData.taskId,
                        workerId,
                    })
                })
            worker.onmessage = ({ data }) => {
                if (data.data.taskId == taskId) {
                    channel$.next(data)
                }
            }

            ctx.info('picked task', {
                taskId,
                worker,
                entryPoint: String(entryPoint),
            })
            worker.postMessage({
                type: 'Execute',
                data: {
                    taskId,
                    workerId,
                    args,
                    entryPoint: `return ${String(entryPoint)}`,
                },
            })
        })
    }
}
