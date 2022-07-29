import { child$, VirtualDOM, HTMLElement$ } from '@youwol/flux-view'
import { ProjectState } from '../../project'
import { CodeEditorView } from './code-editor.view'
import { BehaviorSubject, fromEvent, merge } from 'rxjs'
import { delay, filter, map } from 'rxjs/operators'
import { Carousel3dView, CarouselSide } from '../../carousel-3d'
import { OutputViewNode, SourceNode } from '../../explorer'

/**
 * @category View
 */
export class HeaderBannerView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex w-100 fv-bg-background-alt'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { children: VirtualDOM[] }) {
        Object.assign(this, params)
    }
}
/**
 * @category View
 */
export class HeaderBtnView implements VirtualDOM {
    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'd-flex'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    constructor(params: { icon: string; onClick: (ev) => void }) {
        Object.assign(this, params)

        this.children = [
            {
                class: 'ml-3 mr-2',
                children: [
                    {
                        class: 'fv-btn fv-pointer fv-text-success rounded fv-bg-background-alt fv-border fv-hover-xx-lighter py-0 px-1',
                        children: [
                            {
                                class: params.icon,
                            },
                        ],
                        onclick: params.onClick,
                    },
                ],
            },
        ]
    }
}

/**
 * @category View
 */
export class CodePageView implements VirtualDOM {
    /**
     * @group States
     */
    public readonly projectState: ProjectState

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'h-100 d-flex flex-column'

    /**
     * @group Immutable DOM Constants
     */
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable DOM Constants
     */
    public readonly headerView: VirtualDOM

    /**
     * @group Immutable Constants
     */
    public readonly onCtrlEnter: () => void

    /**
     * @group Immutable Constants
     */
    public readonly sourcePath: string

    /**
     * @group Immutable DOM Constants
     */
    connectedCallback: (htmlElement: HTMLElement$) => void

    constructor(params: {
        sourcePath: string
        projectState: ProjectState
        headerView: VirtualDOM
        onCtrlEnter: () => void
    }) {
        Object.assign(this, params)

        const selectedSide$ = new BehaviorSubject<CarouselSide>('front')

        const codeEditorView = new CodeEditorView({
            sourcePath: this.sourcePath,
            projectState: this.projectState,
            onRun: this.onCtrlEnter,
            refresh$: selectedSide$.pipe(
                filter((side) => side == 'front'),
                delay(800),
            ),
        })

        const wrap$ = (i: number) => {
            return child$(
                merge(
                    this.projectState.runStart$.pipe(
                        map(() => 'start' as 'start'),
                    ),
                    params.projectState.createdOutputs$.pipe(
                        filter((outputViews) => outputViews.length == i + 1),
                    ),
                ),
                (outputViews) => {
                    if (outputViews == 'start' || outputViews.length != i + 1)
                        return {}
                    return {
                        class: 'h-100 w-100 overflow-auto',
                        children: [outputViews[i].htmlElement],
                    }
                },
            )
        }
        const carousel = new Carousel3dView({
            frontView: codeEditorView,
            rightView: wrap$(0),
            backView: wrap$(1),
            leftView: wrap$(2),
            selectedSide$: selectedSide$,
            options: {
                transition: {
                    duration: 0.5,
                    ease: 0.2,
                },
            },
        })
        const getOutputViewIndex = (node) => {
            if (node instanceof SourceNode) return -1
            return this.projectState.explorerState
                .getNode(this.sourcePath)
                .resolvedChildren()
                .findIndex((n) => n.id == node.id)
        }
        const sub0 = this.projectState.explorerState.selectedNode$
            .pipe(
                filter(
                    (node) =>
                        node instanceof OutputViewNode ||
                        (node instanceof SourceNode &&
                            node.path == this.sourcePath),
                ),
                map((node) => {
                    return { 0: 'front', 1: 'right', 2: 'back', 3: 'left' }[
                        getOutputViewIndex(node) + 1
                    ]
                }),
            )
            .subscribe((side: CarouselSide) => {
                selectedSide$.next(side)
            })
        this.children = [
            this.headerView,
            {
                class: 'flex-grow-1 w-100',
                style: {
                    minHeight: '0px',
                },
                children: [carousel],
            },
        ]

        const next: Record<CarouselSide, CarouselSide> = {
            front: 'right',
            right: 'back',
            back: 'left',
            left: 'front',
        }
        const prev: Record<CarouselSide, CarouselSide> = {
            front: 'left',
            left: 'back',
            back: 'right',
            right: 'front',
        }
        const sub1 = fromEvent(document, 'keydown')
            .pipe(
                filter((ev: KeyboardEvent) => {
                    return (
                        (ev.altKey && ev.key == 'ArrowRight') ||
                        (ev.altKey && ev.key == 'ArrowLeft')
                    )
                }),
            )
            .subscribe((ev) => {
                const explorer = params.projectState.explorerState
                const newSide =
                    ev.key == 'ArrowRight'
                        ? next[selectedSide$.getValue()]
                        : prev[selectedSide$.getValue()]
                const scriptNode = explorer.getNode(params.sourcePath)
                const children = scriptNode.resolvedChildren()
                if (newSide == 'front') explorer.selectedNode$.next(scriptNode)
                if (newSide == 'right' && children[0])
                    explorer.selectedNode$.next(children[0] as any)
                if (newSide == 'back' && children[1])
                    explorer.selectedNode$.next(children[1] as any)
                if (newSide == 'left' && children[2])
                    explorer.selectedNode$.next(children[2] as any)
            })
        this.connectedCallback = (htmlElement) => {
            htmlElement.ownSubscriptions(sub0, sub1)
        }
    }
}
