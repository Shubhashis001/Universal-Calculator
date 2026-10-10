import { runRegexTask, type RegexRequest } from '../lib/regexTask';
self.onmessage = (event: MessageEvent<RegexRequest>) => { self.postMessage(runRegexTask(event.data)); };
