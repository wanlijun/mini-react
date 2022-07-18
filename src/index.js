function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) => {
        return typeof child === 'object' ? child : createTextElement(child)
      })
    }
  }
}
function createTextElement(value) {
  return {
    type: 'TEXT_ELEMENT',
    props: {
      nodeValue: value,
      children: []
    }
  }
}

let nextUnitOfWork = null;
let wipRoot = null;
let currentRoot = null;
let deletions = [];

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element]
    },
    alternate: currentRoot
  }
  currentRoot = wipRoot;
  nextUnitOfWork = wipRoot;
  workLoop({timeReaming: 5})
}
function workLoop(deadline) {
  let shouldYield = false
  while(nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeReaming < 1
  }
  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }
  requestIdleCallback(workLoop);
}
requestIdleCallback(workLoop);
function performUnitOfWork(fiber) {
  const isFunctionComponent = typeof fiber.type === 'function';
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }
  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber;
  while(nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
  return nextFiber;
}
let wipFiber = null;
let hookIndex = 0
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  wipFiber.hook = [];
  hookIndex  = 0;
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}
function updateHostComponent(fiber) {
  if(!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}
// 获取字节点的fiber
function reconcileChildren(returnFiber, elements) {
  let index = 0;
  let prevSibling = null;
  let olderFiber = returnFiber.alternate && returnFiber.alternate.child
  console.log(returnFiber, returnFiber.child, '=====reconcileChildren')
  while(index < elements.length || olderFiber != null) {
    const element = elements[index];
    let newFiber;
    const sameType = olderFiber && element && olderFiber.type === element.type;
    if (sameType) {
      newFiber = {
        //自己id
        type: element.type,
        // 属性描述
        props: element.props,
        // 容器，容身之所，地址
        dom: olderFiber.dom,
        // 父母
        parent: returnFiber,
        // 昨天的自己
        alternate: olderFiber,
        // 自己的工作
        effectTag: 'UPDATE'
      }
    } 
    // add
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom:null,
        parent: returnFiber,
        alternate: null,
        effectTag: 'PLACEMENT'
      }
    }
    // delete
    if(olderFiber && !sameType) {
      olderFiber.effectTag = 'DELETION'
      deletions.push(olderFiber);
    }
    // 移动指针
    if (olderFiber) {
      olderFiber = olderFiber.sibling
    }
    // 放置fiber
    if (index === 0) {
      returnFiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }
    // 移动指针
    prevSibling = newFiber;
    index ++
  }
  
}

function createDom(fiber) {
  const dom = fiber.type === 'TEXT_ELEMENT'
    ? document.createTextNode('')
    : document.createElement(fiber.type);
  updateDom(dom, {}, fiber.props);
  return dom;
}
const isEvent = key => key.startsWith('on');
const isProperty = key => key !== 'children';
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next) 
// 更新属性
function updateDom(dom, prev, next) {
  // remove old or changed events
  Object.keys(prev)
    .filter(isEvent)
    .filter(
      key => 
      isGone(prev,next)(key) ||
      isNew(prev, next)(key)
    )
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      document.removeEventListener(
        eventType,
        prev[name]
      )
    })
  // 
  Object.keys(next)
    .filter(isProperty)
    .filter(isGone(prev, next))
    .forEach((name) => {
      dom[name] = ''
    })
  Object.keys(next)
    .filter(isProperty)
    .filter(isNew(prev, next))
    .forEach((name) => {
      dom[name] = next[name]
    })
  Object.keys(next)
    .filter(isEvent)
    .filter(isNew(prev, next))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2)
      document.addEventListener(
        eventType,
        next[name]
      )
    })
}

function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child)
  currentRoot = wipRoot;
  wipRoot = null;
}
function commitWork(fiber) {
  if (!fiber) {
    return ;
  }
  let domParentFiber = fiber.parent
  while(!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom != null) {
    domParent.appendChild(fiber.dom)
  }
  if (fiber.effectTag === 'UPDATE' && fiber.dom) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  }
  if (fiber.effectTag === 'DELETION') {
    commitDeletion(fiber, domParent)
  }
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  }
  commitDeletion(fiber.child, domParent);
}

function useState(initValue) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hook && 
    wipFiber.alternate.hook[hookIndex];
  const hook = {
    state: oldHook ? oldHook.state : initValue,
    queue: []
  }
  const actions = oldHook ? oldHook.queue : []
  actions.forEach((action) => {
    hook.state = action(hook.state)
  })
 
  const setState = (action) => {
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot
    }
    nextUnitOfWork = wipRoot;
    deletions = []
  }
  wipFiber.hook.push(hook)
  hookIndex++;
  return [hook.state, setState]
}
const MinReact = {
  createElement,
  render,
  useState
}


// 测试代码
function App(props) {
  const [state, setState] = MinReact.useState(1)
  return MinReact.createElement(
    "h1",
    {
      onClick: () => setState(c => c + 1)
    },
    "Hi",
    props.name,
    state
  )
}
const appEle = MinReact.createElement(App, {
  name: "foo",
})
const element = MinReact.createElement(
  "div",
  { id: "foo" },
  MinReact.createElement("a", null, "bar"),
  appEle
)

const container = document.getElementById('root');
MinReact.render(element, container);

