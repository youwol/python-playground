import { attr$, Stream$, VirtualDOM } from '@youwol/flux-view'
import { BehaviorSubject, combineLatest } from 'rxjs'
import { debounceTime, map } from 'rxjs/operators'
import { HTMLElement$ } from '@youwol/flux-view/dist'

export type CarouselSide = 'front' | 'right' | 'back' | 'left'

export class Carousel3dView implements VirtualDOM {
    /**
     * @group DOM's style generator
     */
    static baseBoxStyle = (w, h, d) => ({
        width: `${w}px`,
        height: `${h}px`,
        position: 'relative',
        'transform-style': 'preserve-3d',
        transform: `translateZ(-${d / 2}px)`,
        transition: 'transform 0.s ease 0.2s',
    })
    /**
     * @group DOM's style generator
     */
    static showCubeSideStyle: Record<
        CarouselSide,
        (w: number, h: number, d: number) => { [k: string]: string }
    > = {
        front: (_w, _h, d) => ({
            transform: `translateZ(-${d / 2}px) rotateY(0deg)`,
        }),
        right: (w, _h, _d) => ({
            transform: `translateZ(-${w / 2}px) rotateY(-90deg)`,
        }),
        back: (_w, _h, d) => ({
            transform: `translateZ(-${d / 2}px) rotateY(-180deg)`,
        }),
        left: (w, _h, _d) => ({
            transform: `translateZ(-${w / 2}px) rotateY(90deg)`,
        }),
    }
    /**
     * @group Immutable DOM Constants
     */
    static baseCubeFaceStyle = {
        position: 'absolute',
    }
    /**
     * @group DOM's style generator
     */
    static sideCubeFaceStyle: Record<
        CarouselSide,
        (w, h, d) => { [k: string]: string }
    > = {
        front: (w, h, d) => ({
            width: `${w}px`,
            height: `${h}px`,
            transform: `rotateY(  0deg) translateZ(${d / 2}px)`,
        }),
        right: (w, h, d) => ({
            width: `${d}px`,
            height: `${h}px`,
            left: `${w / 2 - d / 2}px`,
            transform: `rotateY( 90deg) translateZ(${w / 2}px)`,
        }),
        back: (w, h, d) => ({
            width: `${w}px`,
            height: `${h}px`,
            transform: `rotateY(180deg) translateZ(${d / 2}px)`,
        }),
        left: (w, h, d) => ({
            width: `${d}px`,
            height: `${h}px`,
            left: `${w / 2 - d / 2}px`,
            transform: `rotateY(-90deg) translateZ(${w / 2}px)`,
        }),
    }

    /**
     * @group Immutable DOM Constants
     */
    public readonly class = 'w-100 h-100'
    public readonly children: VirtualDOM[]

    /**
     * @group Immutable DOM Constants
     */
    public readonly defaultStyle = {
        border: '1px solid #CCC',
        perspective: '1000px',
    }

    /**
     * @group Observable
     */
    public readonly style: Stream$<
        { width: number; height: number; depth: number },
        { [k: string]: string }
    >
    /**
     * @group Immutable DOM Constants
     */
    public readonly connectedCallback: (
        htmlElement: HTMLDivElement & HTMLElement$,
    ) => void

    constructor(params: {
        frontView: VirtualDOM
        rightView: VirtualDOM
        backView: VirtualDOM
        leftView: VirtualDOM
        selectedSide$: BehaviorSubject<CarouselSide>
    }) {
        const sizeRaw$ = new BehaviorSubject({ width: 0, height: 0, depth: 0 })
        let isResizing = true

        this.connectedCallback = (htmlElement: HTMLDivElement) => {
            const resizeObserver = new ResizeObserver(() => {
                const dim = {
                    width: Math.floor(htmlElement.parentElement.clientWidth),
                    height: Math.floor(htmlElement.parentElement.clientHeight),
                    depth: Math.floor(htmlElement.parentElement.clientWidth),
                }

                isResizing = true
                sizeRaw$.next(dim)
            })
            resizeObserver.observe(htmlElement.parentElement)
        }
        sizeRaw$.pipe(debounceTime(100)).subscribe(() => {
            isResizing = false
            params.selectedSide$.next(params.selectedSide$.getValue())
        })

        const size$ = sizeRaw$

        const content: Record<CarouselSide, VirtualDOM> = {
            front: params.frontView,
            right: params.rightView,
            back: params.backView,
            left: params.leftView,
        }
        const styleSize$ = size$.pipe(
            map((size) => ({
                width: `${size.width}px`,
                height: `${size.height}px`,
            })),
        )
        this.style = attr$(size$, (size) => ({
            ...this.defaultStyle,
            width: `${size.width}px`,
            height: `${size.height}px`,
        }))
        const sides: CarouselSide[] = ['front', 'right', 'back', 'left']

        const faces = sides.map((side) => {
            return {
                style: attr$(
                    combineLatest([size$, styleSize$]),
                    ([size, styleSize]) => {
                        return {
                            ...styleSize,
                            ...Carousel3dView.baseCubeFaceStyle,
                            ...Carousel3dView.sideCubeFaceStyle[side](
                                size.width,
                                size.height,
                                size.depth,
                            ),
                        }
                    },
                ),
                children: [content[side]],
            }
        })
        this.children = [
            {
                class: 'box',
                style: attr$(
                    combineLatest([params.selectedSide$, size$, styleSize$]),
                    ([side, size, styleSize]) => {
                        return {
                            ...styleSize,
                            ...Carousel3dView.baseBoxStyle(
                                size.width,
                                size.height,
                                size.depth,
                            ),
                            ...Carousel3dView.showCubeSideStyle[side](
                                size.width,
                                size.height,
                                size.depth,
                            ),
                            transition: isResizing
                                ? 'transform 0s'
                                : 'transform 0.5s ease 0.2s',
                        }
                    },
                ),
                children: faces,
            },
        ]
    }
}
