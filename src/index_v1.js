// 老板让我制作一个3d打印机，这个打印机可以打印任意的建筑
// 第一步：提供一个画设计图的方法，让客户把他心目中的游乐场画出来
// type：元素的类型，标注这一块是什么材料，水泥、玻璃还是大理石
// props:属性，颜色 ，大小
// children,这个部件里面包含了什么东西,例如一面墙是由很多砖头组成
// 每次都要描述一个element有些麻烦，为了方便，3d打印机允许客户用一些简单的方式来代表某一些东西
// 例如 画一条线代表一根绳子，然后我们自动为这个绳子创建element对象
// 所以如果children只是一个字符串或者数字的话，我们允许客户直接传入一个原始类型的
// 但是为了后面处理起来比较方便，我们需要自动给这些原始类型包装一下。因为我们知道，送到机器里面加工的东西，那肯定要整齐，对吧？
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) => {
        return typeof child === 'object'  
                ? child
                : createTextElement(child)
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


// 第二步，当用户按照我们定下的规则将图画好，还要告诉我们在什么地方渲染，要去政府拍一块地吧，这个就是container
// 等这两个都准备好了，就可以按下我们的开关，准备打印游乐场了。
// 开关链接是一个的render函数。
// 公司老板希望在打印大任务的同时，可以优先打印一些小任务或者一些紧急的任务,不然就发不起工资了
// 例如在打印游乐场的时候，老板想要先打印一架飞机
// 这需要render是可中断的，所以要将整个流程拆分成更小的单元，每一个小部件都是一个工作单元，每一个element都对应一个fiber

// 指向下一个要工作的fiber
let nextUnitOfWork = null
// 当前正在工作的root
let wipRoot = null
// 已经完成渲染工作的root,及上一次渲染的root
let currentRoot =null;
// 待删除的节点
let deletions = []
// render函数是机器的开关
// 初始化root fiber,放到workLoop
// 然后启动workLoop开始工作
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
  workLoop({timeReaming:5})
}
// 先比之前的递归，现在把循环的方式改完了中断的while循环
// 循环的条件是当前还有任务，并且还有剩余时间
// workLoop相当于是一个传送带
// 不断的把东西送到相关部门上进行加工
function workLoop(deadline) {
  let shouldYield = false;
 while(nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(
    nextUnitOfWork
    )
    // 每执行完一个单元就去检查是否还有剩余时间可以继续执行
    shouldYield = deadline.timeReaming < 1
 }
 // 如果任务全部执行完，就进入commit阶段
 if (!nextUnitOfWork && wipRoot) {
  commitRoot()
 }
 // 利用requestIdleCallback，重启任务，浏览器会在其他任务完成时重新调度这个任务
 requestIdleCallback(workLoop)
}
requestIdleCallback(workLoop)
// 传送带workLoop送过来的fiber,会交由performUnitOfWork执行
// performUnitOfWork会有一个分拣功能，将不同类型的fiber交给不同的工厂加工
// 具体的执行每一个任务
// 1.根据fiber的类型，将fiber送入不同的工厂
// 2.选择下一个工作单元，找下一个工作单元的规则：
// 1）判断该fiber是有子节点，有的话下一个工作单元就是子节点
// 2) 如果没有子节点，就去找兄弟节点
// 3）既没有子节点有没有兄弟节点，就去找叔叔节点（父节点的兄弟）
function performUnitOfWork(fiber) {
  
  // 这里判断如果fiber没有创建dom，就先调用createDom创建dom方法
  const isFunctionComponent =
  fiber.type instanceof Function;
  if(isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }
  // 选皇上了
  // 自己的长子，
  if (fiber.child) {
    return fiber.child
  }
  // 如果没有孩子了，那就只能传给兄弟,如果没有兄弟就只能往上找，找自己的叔叔
  let nextFiber = fiber;
  while(nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
  return nextFiber;
}
let wipFiber = null; // 存储当前工作的fiber
let hookIndex = null
// 函数类型的fiber
// 调用函数组件的函数，得到children送往reconcileChildren
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex  = 0;
  wipFiber.hooks = [];
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}
// 创建dom
// 然后调用reconcileChildren创建子节点
function updateHostComponent(fiber) {
  // 如果fiber的parent存在，就改fiber的dom添加父节点的fiber
  // 将这个部件放置到它的容器里面
  // 之前这里是加工一点就输出一点，可以想象打印机，是一行一行打印的
  // 如果这个时候打印机要去完成其他打印任务了，就向客户输出一个半成品
  // 这不是我们想要的，所以这里先要注释，先在内部把整颗树构建完，然后一下子输出。
  // if(fiber.parent) {
  //   fiber.parent.dom.appendChild(fiber.dom)
  // }
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  reconcileChildren(fiber, fiber.props.children)
}
// 运用diff算法，创建不同的fiber,对应更新、新增、删除
// 然后将这个fiber放在正确的位置，例如第一个节点，就保存在fiber.child
// 不然就就是第一个子fiber.sibling
function reconcileChildren(returnFiber, elements) {
  let index = 0;
  let prevSibling = null;
  let olderFiber = returnFiber.alternate && returnFiber.alternate.child
  // 把数组构建成一棵树
 
  while(
    index < elements.length ||
    olderFiber != null
  ) {
    const element = elements[index];
    let newFiber = null
    // 比较新的fiber和之前的fiber
    const sameType = 
      olderFiber &&
      element &&
      element.type === olderFiber.type
      
    if (sameType) {
      // update
      newFiber = {
        type: olderFiber.type,
        props: element.props,
        dom: olderFiber.dom,
        parent: returnFiber,
        alternate: olderFiber,
        effectTag: "UPDATE"
      }
    }
    if (element && !sameType) {
      // add
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: returnFiber,
        alternate: null,
        effectTag: "PLACEMENT"
      }
    }
    if (olderFiber && !sameType) {
      //remove
      olderFiber.effectTag = "DELETION"
      deletions.push(olderFiber)
    }
   
    // 如果是第一个子节点，就保存到fiber.child属性上
    // 这就好比只有皇帝的长子才能继承皇位，其他的全都要到各个地方去当王爷
    // 都归这个皇帝管
    if(olderFiber) {
      olderFiber = olderFiber.sibling
    }
    if (index === 0) {
      returnFiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }
    prevSibling = newFiber
    index++
  }
}
// render现在变得很复杂了，所以我们现在要按照功能将整个工作分成一个一个的原件
// 这个原件的工作就是根据fiber创建dom
function createDom(fiber) {
  const dom =
  fiber.type === 'TEXT_ELEMENT'
    ? document.createTextNode('')
    : document.createElement(fiber.type);
  updateDom(dom, {}, fiber.props)
  return dom;
}

const isEvent = key => key.startsWith("on")
const isProperty = key => key !== "children"
const isNew = (prev, next) => key => prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)
// 比较两个fiber的属性，移除已经删除的属性，添加和更新属性
function updateDom(dom, preProps, nextProps) {
  // remove old or changed event listeners
  Object.keys(preProps)
    .filter(isEvent)
    .filter(
      key =>
       !(key in nextProps) ||
       isNew(preProps, nextProps)(key)
    ).forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.removeEventListener(
        eventType,
        preProps[name]
      )
    })
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isGone(preProps, nextProps))
    .forEach(name => {
      dom[name] = ''
    });
   
    Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(preProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    }); 
  // add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(preProps, nextProps))
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2);
      dom.addEventListener(
        eventType,
        nextProps[name]
      )
    })
}
// commit也需要修改了，因为现在会有fiber没有dom节点了
// 这些函数节点是建筑的内在描述，没有实际的样子
// 比如说有个函数组件承载了这样一段逻辑，每个卧室的靠床头的那一面墙刷成蓝色
// 执行这个函数后会给没面强刷上正确的颜色，但是这个函数却不是一个实物，所以不能挂载dom上
// 需要向外找容器，例如，地上起了一面墙，关于这个墙要刷什么颜色呢我这里放了一段逻辑在这里，这面墙的所有砖的颜色都成蓝色
// 但是这个砖最终是要放在地面上的
function commitRoot() {
  // 先执行删除
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}
function commitWork(fiber) {
  if (!fiber) {
    return 
  }
  let domParentFiber = fiber.parent;
  while(!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom;
  if(
    fiber.effectTag === "PLACEMENT" &&
    fiber.dom != null
  ) {
    domParent.appendChild(fiber.dom)
  } else if (
    fiber.effectTag === "UPDATE" &&
    fiber.dom !=null
  ) {
    updateDom(
      fiber.dom,
      fiber.alternate.props,
      fiber.props
    )
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent)
  }
  commitWork(fiber.child)
  commitWork(fiber.sibling)
  
}
// 删除也是要找到实际的dom删除
function commitDeletion(fiber, domParent) {
  if(fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

// 第七步，支持函数组件
// 函数组件里面可以包含处理逻辑，例如发请求，保存状态等
// 函数组件的和普通的element不一样的地方在于：1）函数的组件的fiber没有dom节点2）他的子节点是函数的返回值，而不是直接从props获取。
// 根据这两点需要修改

// 第八步，实现hook，对于状态管理来说，就像是向外暴露了一个按钮，按一下墙体颜色就更新了
// 打印机就自动启动重新开始渲染和构建
function useState(initial) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks&&
    wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: []
  }
  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action(hook.state)
  })
  const setState = (action) => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  }
  wipFiber.hooks.push(hook)
  hookIndex++
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