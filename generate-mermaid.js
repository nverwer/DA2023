const acorn = require("acorn") // https://github.com/acornjs/acorn
const fs = require('fs');

// These functions will be excluded from the diagram.
// In code, we use 'method' to avoid the reserved identifier 'function'.
const ignoredMethods =
  [ 'createElement', 'dispatchEvent',
    'checkValidity', 'reportValidity',
    'normalizeSearchString', 'showDetailsDialog', 'closeDetailsDialog',
    'throwAwayEvent'
  ];

// Make a Mermaid node from text.
function mmNode(text) {
  if (text == 'constructor') {
    return '.constructor[[constructor]]';
  } else {
    return text.replace(/[^A-Za-z0-9]/g, '');
  }
}

// Generate the call graph.
// node: A node in the abstract syntax tree (https://github.com/estree/estree).
// contextFunction: The context in which `node` appears, i.e., the calling function.
// level: Indenting level.
// Returns the call graph as an object { functionName -> [ calledFunctionName, ... ], ... }.
function generateCallGraph(node, contextFunction, level) {
  contextFunction = contextFunction || '';
  level = level || '';
  let flow = {}; // The call graph.
  let children = []; // Functions that are called by this `node`.
  if (false) { // Debug: show the abstract syntax tree.
    console.debug(`${level}${node.type} : ${Object.keys(node).
      filter(k => k != 'body').
      map(k => (node[k] && typeof(node[k]) == 'object') ?
        `${k}: { ${Object.keys(node[k]).filter(kk => kk != 'body').map(kk => `${kk}: ${node[k][kk]}`).join(', ')} }` :
        `${k}: ${node[k]}`).join(', ')}`);
  }
  // Depending on the node type, add the `node` to the call graph.
  if (node.type == 'MethodDefinition') {
    contextFunction = mmNode(node.key.name);
    flow[contextFunction] = []; // Add the function name to the call graph.
  }
  if (node.type == 'ExpressionStatement') {
    children = [node.expression]; // Includes everything that is called by this `node`.
  }
  if (node.type == 'CallExpression' && contextFunction != '') {
    if (node.callee?.property?.name) {
      const calledFunction = mmNode(node.callee.property.name);
      // Event listeners are starting points of the call graph.
      if (calledFunction == 'addEventListener') {
        const targetName =
          (node.callee?.object?.name) ? node.callee.object.name :
          (node.callee?.object?.property?.name) ? node.callee.object.property.name :
          node.callee.object?.arguments?.find(arg => arg.type == 'Literal')?.value;
        const eventName = node.arguments[0].value;
        const contextName = targetName+'!'+eventName;
        contextFunction = mmNode(contextName)+'[['+contextName+']]';
        flow[contextFunction] = [];
        children = [node.arguments[1]]; // What is called when the event occurs.
      } else if (!flow[contextFunction]) {
        flow[contextFunction] = [calledFunction];
      } else if (!flow[contextFunction].includes(calledFunction)) {
        flow[contextFunction].push(calledFunction);
      }
    }
  }
  // Collect all potential children. The code above will sort them out.
  if (children.length == 0) {
    children = Object.values(node).
    flatMap(property => {
      if (Array.isArray(property)) return property;
      if (typeof(property) == 'object') return property;
      return [];
    }).
    filter(child => !!child);
  }
  // Merge the results from children into flow.
  for (let child of children) {
    for (const [method, calledFunctions] of Object.entries(generateCallGraph(child, contextFunction, level+'  '))) {
      if (flow.hasOwnProperty(method)){
        calledFunctions.forEach(calledFunction => {
          if (!flow[method].includes(calledFunction)) {
            flow[method].push(calledFunction)
          }
        });
      } else {
        flow[method] = calledFunctions;
      }
    }
  }
  // Return the call graph.
  return flow;
}

/* Find multiple paths between nodes. */

// Depth-first search. This is quadratic!
function dfs(graph, start, target, visited, path, paths) {
  visited[start] = true;
  path.push(start);
  if (start === target) {
      paths.push([...path]);
  } else if (graph[start]) {
      for (let node of graph[start]) {
          if (!visited[node]) {
              dfs(graph, node, target, visited, path, paths);
          }
      }
  }
  path.pop();
  visited[start] = false;
}

// Under development, do not use.
function findMultiplePaths(graph) {
  let nodes = Object.keys(graph);
  let result = {};
  for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
          let start = nodes[i];
          let target = nodes[j];
          let visited = {};
          let path = [];
          let paths = [];
          dfs(graph, start, target, visited, path, paths);
          if (paths.length > 1) {
              result[`${start} - ${target}`] = paths;
          }
      }
  }
  return result;
}

/* Main program. */

// There is one argument, the web-component JS file.
if (process.argv.length !== 3) {
  console.error(`Usage: ${process.argv[1]} <web-component.js>`);
  process.exit(1);
}
const inputFileName = process.argv[2];
const outputFileName = inputFileName.replace(/\.\w+$/, '')+'.md';

// Use the Acorn parser (https://github.com/acornjs/acorn/tree/master/acorn/)
// extended to parse class fields (https://github.com/acornjs/acorn-class-fields).
const parser = acorn.Parser.extend(require('acorn-class-fields'), require('acorn-private-methods'));

// Read the web component and parse it.
const jsText = fs.readFileSync(inputFileName, 'utf8');
const parsedJS = parser.parse(jsText, { ecmaVersion: 'latest' });

// Create the call graph `flow`: { functionName -> [ calledFunctionName, ... ], ... }
let flow = generateCallGraph(parsedJS);

// Get the names of functions that we want to keep in the graph.
const relevantMethods = Object.keys(flow).filter(method => !ignoredMethods.includes(method)).sort();

// Prune the call graph, removing ignored functions.
for (let method of Object.keys(flow)) {
  if (ignoredMethods.includes(method)) {
    delete(flow[method]);
  } else {
    flow[method] = flow[method].filter(m => relevantMethods.includes(m)).sort();
  }
}

// Create the output file.
const mdFile = fs.openSync(outputFileName, 'w');
console.log (`Writing mermaid output to ${outputFileName}`);
try {
  fs.writeSync(mdFile, '```mermaid\nflowchart LR\n\n');

  // The events are in a separate subgraph, so they are clearly visible.
  fs.writeSync(mdFile, 'subgraph events\n');
  for (let method of relevantMethods) {
    if (method.includes('[[') && flow[method].length > 0) {
      fs.writeSync(mdFile, method+'\n');
    }
  }
  fs.writeSync(mdFile, 'end\n\n');

  // Draw the rest of the call graph.
  for (let method of relevantMethods) {
    const calleds = flow[method];
    for (let called of calleds) {
      if (method.includes('[[')) {
        fs.writeSync(mdFile, `${method} ---> ${called}\n`);
      } else {
        fs.writeSync(mdFile, `${method} --> ${called}\n`);
      }
    }
    if (calleds.length > 0) {
      fs.writeSync(mdFile, '\n');
    }
  }

  fs.writeSync(mdFile, '```\n');
} catch (err) {
  console.error(err);
} finally {
  fs.closeSync(mdFile);
}

//console.info(findMultiplePaths(flow));
