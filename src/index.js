// 老板让我们制作一个3d打印机，可以打印任意的建筑
// 第一步：提供一个画设计图的方法，让客户把他心目中的游乐场画出来
// type：元素的类型，标注这一块是什么材料，水泥、玻璃还是大理石
// props:属性，颜色 ，大小
// children,这个部件里面包含了什么东西,也是一个element
// 每次都要描述一个element有些麻烦，为了方便，3d打印机允许我们用一些简单的方式来代表某一些东西
// 例如 画一条线代表一根绳子，然后我们自动为这个绳子创建element对象
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


// 第二步，当用户按照我们定下的规则将图画好，还有告诉我们在什么地方渲染，要去政府拍一块地吧
// 等这两个都准备好了，就可以按下我们的启动开关，准备打印游乐场了。
// 这个开关就是向外暴露的render函数。

// render函数现在最简单的工作就是，递归按照图上的设计，创建实际的dom,比如图上标注这里是一块面30*30的玻璃，他要安装到窗户上
// function render(elements, container) {
//   const {
//     type,
//     props
//   } = elements;
//   // 创建node
//   const node =
//     elements.type === 'TEXT_ELEMENT'
//       ? document.createTextNode('')
//       : document.createElement(elements.type);
//   const isProperty = (propName) => propName !== 'children'; 

//   // 设置这个部件的一些属性，描绘属性，例如是白色的墙还是红色的墙
//   Object.keys(props)
//   .filter(isProperty)
//   .forEach((propName) => {
//     node[propName] = props[propName]
//   })
//   // 渲染子部件，例如大楼里面的墙,每面墙的砖
//   props.children.forEach((element) => {
//     render(element, node)
//   })
//   // 渲染好的这个部件放在这个容器里面，例如把这面强放在地板的上面
//   container.appendChild(node);
// }

// 现在这个打印机要升级，打印一栋大楼要花费好长时间呢，
// 公司老板希望在打印大任务的同时，可以优先打印一些小任务或者一些紧急的任务,不然就发不起工资了
// 例如我现在要打印一架飞机
// 如果要把之前的render改成可中断的，那肯定是要整个流程拆分成更小的单元，那则么分呢，每一个小部件都是一个工作单元吧
// 这个打印机需要新增一块来控制，渲染流程了
let nextUnitOfWork = null
let wipRoot = null
let currentRoot =null;
let deletions = []
// render函数还是所有函数的起点
// 初始化root fiber,然后启动workLoop开始工作
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
// 循环的条件是还有任务，并且还有剩余时间
// workLoop相当于是一个传送带
// 不断的把东西送到相关机器上进行加工
function workLoop(deadline) {
  let shouldYield = false;
 while(nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(
    nextUnitOfWork
    )
    // 每执行完一个单元就去检查是否还有剩余时间可以继续执行
    shouldYield = deadline.timeReaming < 1
 }
 if (!nextUnitOfWork && wipRoot) {
  commitRoot()
 }
 // 利用requestIdleCallback，重启任务，浏览器会在其他任务完成时重新调度这个任务
 requestIdleCallback(workLoop)
}
requestIdleCallback(workLoop)
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
    domParent.removeChild(fiber.dom)
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
// 具体的执行每一个任务
// 1.将element添加dom
// 2.创建子节点的fiber
// 3.选择下一个工作单元，找下一个工作单元的规则：
// 1）判断安是否有子节点，有的话下一个工作单元就是子节点
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
  // 为子节创建fiber
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
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex  = 0;
  wipFiber.hooks = [];
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}
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

render(element, container);