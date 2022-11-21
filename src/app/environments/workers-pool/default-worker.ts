import { WorkersPool } from '../../models'
import { v4 as uuidv4 } from 'uuid'

export const defaultWorkerSrc = `
"""
Approximate the value op Pi from random draws in a 1*1 squares.
Approximation gets better with the number of samples drawn.

The following snippet is an example on how to trigger the computation from the main thread:
'
from python_playground.main_thread import application
from python_playground.main_thread.worker import Listener

# make sure a 'Workers-pool 0' exists in your project, required 'numpy' dependency.
worker_pool = application.get_worker_pool('Workers-pool 0')
print("Reserve workers")
# This is how you can scale dynamically the workers-pool
await worker_pool.reserve(1)
print("Reservation done")

task = {
    "title": "approximate pi value", 
    "entryPoint": {
        "file": "entry",
        "function": "compute"
    },
    "argument": {
        "samplings": [1e2, 1e4, 1e6, 1e7]
    } 
}

result = await worker_pool.schedule(
    task, 
    Listener(lambda d: print("Got intermediate result",d))
)

print(f"Got  final result", result)
'
"""

import numpy as np
import math
from python_playground.worker_thread import Emitter

def calc_pi(n):
    """
    @params n : number of draws
    @return approximation of Pi
    """
    r = 0
    for i in range(3):
        data = np.random.uniform(-0.5, 0.5, size=(n, 2))
        inside = len(
            np.argwhere(
                np.linalg.norm(data, axis=1) < 0.5
            )
        )
        r = r + (inside / n * 4)
    return r / 3

def compute(d, output):
    output_stream.send_data(len(d))
    
input_stream.on_data( lambda d: compute(d, output_compute) )
`

export function getDefaultWorker({ name }: { name: string }): WorkersPool {
    return {
        id: `${uuidv4()}`,
        name,
        capacity: 2,
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
        sources: [
            {
                path: './worker_entry.py',
                content: defaultWorkerSrc,
            },
        ],
    }
}
