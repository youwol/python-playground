import { PyWorker } from '../models'
import { v4 as uuidv4 } from 'uuid'

export const defaultWorkerSrc = `
from yw_pyodide import input_stream, output_compute

def compute(d, output):
    output.send(len(d))
    
input_stream.on_input( lambda d: compute(d, output_compute) )
`

export function getDefaultWorker({ name }: { name: string }): PyWorker {
    return {
        id: `${uuidv4()}`,
        name,
        environment: {
            requirements: {
                pythonPackages: [],
                javascriptPackages: {
                    modules: [],
                    aliases: {},
                },
            },
            configurations: [
                {
                    name: 'default',
                    scriptPath: './worker_entry.py',
                },
            ],
        },
        inputs: [
            {
                name: 'input',
            },
        ],
        outputs: [
            {
                name: 'output',
            },
        ],
        sources: [
            {
                path: './worker_entry.py',
                content: defaultWorkerSrc,
            },
        ],
    }
}
