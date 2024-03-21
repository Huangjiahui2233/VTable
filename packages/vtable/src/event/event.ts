// import { FederatedPointerEvent } from '@src/vrender';
import type { FederatedPointerEvent, Gesture } from '@src/vrender';
import { RichText } from '@src/vrender';
import type { MousePointerCellEvent } from '../ts-types';
import { IconFuncTypeEnum } from '../ts-types';
import type { StateManager } from '../state/state';
import type { Group } from '../scenegraph/graphic/group';
import { TABLE_EVENT_TYPE } from '../core/TABLE_EVENT_TYPE';
import type { Icon } from '../scenegraph/graphic/icon';
import { checkCellInSelect } from '../state/common/check-in-select';
import { bindMediaClick } from './media-click';
import { bindDrillEvent, checkHaveDrill, drillClick } from './drill';
import { bindSparklineHoverEvent } from './sparkline-event';
import type { BaseTableAPI } from '../ts-types/base-table';
import { checkHaveTextStick, handleTextStick } from '../scenegraph/stick-text';
import { bindGesture, bindTableGroupListener } from './listener/table-group';
import { bindScrollBarListener } from './listener/scroll-bar';
import { bindContainerDomListener } from './listener/container-dom';
import { bindTouchListener } from './listener/touch';
import { getCellEventArgsSet, type SceneEvent } from './util';
import { bindAxisClickEvent } from './pivot-chart/axis-click';
import { bindAxisHoverEvent } from './pivot-chart/axis-hover';
import type { PivotTable } from '../PivotTable';
import { Env } from '../tools/env';
import type { ListTable } from '../ListTable';
import { isValid } from '@visactor/vutils';
import { InteractionState, type KeydownEvent, type ListTableAPI } from '../ts-types';

export class EventManager {
  table: BaseTableAPI;
  // _col: number;
  // _resizing: boolean = false;
  // /** 为了能够判断canvas mousedown 事件 以阻止事件冒泡 */
  // isPointerDownOnTable: boolean = false;
  isTouchdown: boolean; // touch scrolling mode on
  touchMovePoints: {
    x: number;
    y: number;
    timestamp: number;
  }[]; // touch points record in touch scrolling mode
  touchSetTimeout: any; // touch start timeout, use to distinguish touch scrolling mode and default touch event
  touchEnd: boolean; // is touch event end when default touch event listener response
  touchMove: boolean; // is touch listener working, use to disable document touch scrolling function
  gesture: Gesture;
  handleTextStickBindId: number;

  //鼠标事件记录。 PointerMove敏感度太高了 记录下上一个鼠标位置 在接收到PointerMove事件时做判断 是否到到触发框选或者移动表头操作的标准，防止误触
  LastPointerXY: { x: number; y: number };
  LastBodyPointerXY: { x: number; y: number };
  isDown = false;
  isDraging = false;
  isFilling = false;
  LastRange: any = [];
  SelectData: any;
  globalEventListeners: { name: string; env: 'document' | 'body' | 'window'; callback: (e?: any) => void }[] = [];

  constructor(table: BaseTableAPI) {
    this.table = table;
    if (Env.mode === 'node') {
      return;
    }
    this.bindOuterEvent();
    setTimeout(() => {
      this.bindSelfEvent();
    }, 0);
  }

  // 绑定DOM事件
  bindOuterEvent() {
    bindTableGroupListener(this);
    bindContainerDomListener(this);
    bindScrollBarListener(this);
    bindTouchListener(this);
    bindGesture(this);
  }
  updateEventBinder() {
    setTimeout(() => {
      // 处理textStick 是否绑定SCROLL的判断
      if (checkHaveTextStick(this.table) && !this.handleTextStickBindId) {
        this.handleTextStickBindId = this.table.on(TABLE_EVENT_TYPE.SCROLL, e => {
          handleTextStick(this.table);
        });
      } else if (!checkHaveTextStick(this.table) && this.handleTextStickBindId) {
        this.table.off(this.handleTextStickBindId);
        this.handleTextStickBindId = undefined;
      }
    }, 0);
  }
  bindSelfEvent() {
    if (this.table.isReleased) {
      return;
    }

    const stateManager: StateManager = this.table.stateManager;

    // 图标点击
    this.table.on(TABLE_EVENT_TYPE.ICON_CLICK, iconInfo => {
      const { col, row, x, y, funcType, icon, event } = iconInfo;
      // 下拉菜单按钮点击
      if (funcType === IconFuncTypeEnum.dropDown) {
        stateManager.triggerDropDownMenu(col, row, x, y, event);
      } else if (funcType === IconFuncTypeEnum.sort) {
        stateManager.triggerSort(col, row, icon, event);
      } else if (funcType === IconFuncTypeEnum.frozen) {
        stateManager.triggerFreeze(col, row, icon);
      } else if (funcType === IconFuncTypeEnum.drillDown) {
        drillClick(this.table);
      } else if (funcType === IconFuncTypeEnum.collapse || funcType === IconFuncTypeEnum.expand) {
        this.table.stateManager.updateSelectPos(-1, -1);
        this.table.toggleHierarchyState(col, row);
      }
    });

    // 下拉菜单内容点击
    this.table.on(TABLE_EVENT_TYPE.DROPDOWN_MENU_CLICK, () => {
      stateManager.hideMenu();
    });

    // 处理textStick
    if (checkHaveTextStick(this.table)) {
      this.handleTextStickBindId = this.table.on(TABLE_EVENT_TYPE.SCROLL, e => {
        handleTextStick(this.table);
      });
    }

    // link/image/video点击
    bindMediaClick(this.table);

    // 双击自动列宽
    this.table.on(TABLE_EVENT_TYPE.DBLCLICK_CELL, (e: MousePointerCellEvent) => {
      if (e.federatedEvent) {
        const eventArgsSet = getCellEventArgsSet(e.federatedEvent as any);
        const resizeCol = this.table.scenegraph.getResizeColAt(
          eventArgsSet.abstractPos.x,
          eventArgsSet.abstractPos.y,
          eventArgsSet.eventArgs?.targetCell
        );
        if (this.table._canResizeColumn(resizeCol.col, resizeCol.row) && resizeCol.col >= 0) {
          this.table.scenegraph.updateAutoColWidth(resizeCol.col);

          // if (this.table.isPivotChart()) {
          this.table.scenegraph.updateChartSize(resizeCol.col);
          // }
          const state = this.table.stateManager;
          // update frozen shadowline component
          if (
            state.columnResize.col < state.table.frozenColCount &&
            !state.table.isPivotTable() &&
            !(state.table as ListTable).transpose
          ) {
            state.table.scenegraph.component.setFrozenColumnShadow(
              state.table.frozenColCount - 1,
              state.columnResize.isRightFrozen
            );
          }
        }
      }
    });

    // drill icon
    if (this.table.isPivotTable() && checkHaveDrill(this.table as PivotTable)) {
      bindDrillEvent(this.table);
    }

    // chart hover
    bindSparklineHoverEvent(this.table);

    // axis click
    bindAxisClickEvent(this.table);

    // chart axis event
    bindAxisHoverEvent(this.table);
  }

  dealTableHover(eventArgsSet?: SceneEvent) {
    if (!eventArgsSet) {
      this.table.stateManager.updateHoverPos(-1, -1);
      return;
    }
    const { eventArgs } = eventArgsSet;

    if (eventArgs) {
      this.table.stateManager.updateHoverPos(eventArgs.col, eventArgs.row);
    } else {
      this.table.stateManager.updateHoverPos(-1, -1);
    }
  }

  dealIconHover(eventArgsSet: SceneEvent) {
    const { eventArgs } = eventArgsSet;

    if (eventArgs) {
      this.table.stateManager.updateHoverIcon(
        eventArgs.col,
        eventArgs.row,
        eventArgs.target,
        eventArgs.targetCell,
        eventArgs.event
      );
    } else {
      this.table.stateManager.updateHoverIcon(-1, -1, undefined, undefined);
    }
  }

  dealMenuHover(eventArgsSet: SceneEvent) {
    // menu自身状态实现
  }

  dealTableSelect(eventArgsSet?: SceneEvent, isSelectMoving?: boolean): boolean {
    if (!eventArgsSet) {
      this.table.stateManager.updateSelectPos(-1, -1);
      return false;
    }
    const { eventArgs } = eventArgsSet;

    if (eventArgs) {
      if (eventArgs.target.name === 'checkbox') {
        return false;
      }

      // // 注意：如果启用下面这句代码逻辑 则在点击选中单元格时失效hover效果。但是会导致chart实例的click事件失效，所以先特殊处理这个逻辑
      // if (
      //   !this.table.isPivotChart() &&
      //   eventArgsSet?.eventArgs?.target.type !== 'chart' &&
      //   eventArgs.event.pointerType !== 'touch'
      // ) {
      //   this.table.stateManager.updateHoverPos(-1, -1);
      // }
      const define = this.table.getBodyColumnDefine(eventArgs.col, eventArgs.row);
      if (
        this.table.isHeader(eventArgs.col, eventArgs.row) &&
        (define?.disableHeaderSelect || this.table.stateManager.select?.disableHeader)
      ) {
        if (!isSelectMoving) {
          // 如果是点击点表头 取消单元格选中状态
          this.table.stateManager.updateSelectPos(-1, -1);
        }
        return false;
      } else if (!this.table.isHeader(eventArgs.col, eventArgs.row) && define?.disableSelect) {
        if (!isSelectMoving) {
          this.table.stateManager.updateSelectPos(-1, -1);
        }
        return false;
      }

      if (
        this.table.isPivotChart() &&
        (eventArgsSet?.eventArgs?.target.name === 'axis-label' || eventArgsSet?.eventArgs?.target.type === 'chart')
      ) {
        // 点击透视图坐标轴标签或图标内容，执行图表状态更新，不触发Select
        this.table.stateManager.updateSelectPos(-1, -1);
        return false;
      }
      // console.log(this.checkCellFillhandle(eventArgsSet));
        console.log(isSelectMoving);
        console.log(this.table.eventManager.isFilling);
        // console.log(this.table.stateManager.select?.ranges?.length);
        // console.log(this.checkCellFillhandle(eventArgsSet));
       
        if (this.table.stateManager.select?.ranges?.length && this.table.eventManager.isFilling) {
        //  if (isSelectMoving !== true) {
        //   const currentRange = this.table.stateManager.select.ranges[this.table.stateManager.select.ranges.length - 1];
      
        //   this.table.stateManager.updateSelectPos(
       
        //     currentRange.start.col,
        //     currentRange.start.row,
        //     true,
        //     eventArgs.event.ctrlKey || eventArgs.event.metaKey
        //   );
        //   return false;
        // }
      let updateRow;
      let updateCol;
      const currentRange = this.table.stateManager.select.ranges[this.table.stateManager.select.ranges.length - 1];
      console.log(currentRange);
      console.log(eventArgs.col, eventArgs.row);

      if (Math.abs(currentRange.start.row - eventArgs.row) >= Math.abs(currentRange.start.col - eventArgs.col)) {
  
           updateRow = eventArgs.row;
        updateCol = currentRange.end.col;
  
        
      } else {
            updateRow = currentRange.end.row;
        updateCol = eventArgs.col;
      }

      console.log(updateRow,updateCol);


      this.table.stateManager.updateSelectPos(
       
        updateCol,
        updateRow,
        true,
        eventArgs.event.ctrlKey || eventArgs.event.metaKey
      );
         
      } else {
         this.table.stateManager.updateSelectPos(
        eventArgs.col,
        eventArgs.row,
        eventArgs.event.shiftKey,
        eventArgs.event.ctrlKey || eventArgs.event.metaKey
      );
      }
      
      // this.table.stateManager.updateSelectPos(
      //   eventArgs.col,
      //   eventArgs.row,
      //   eventArgs.event.shiftKey,
      //   eventArgs.event.ctrlKey || eventArgs.event.metaKey
      // );
      return true;
      
      
    }
    // this.table.stateManager.updateSelectPos(-1, -1); 这句有问题 如drag框选鼠标超出表格范围 这里就直接情况是不对的
    return false;
  }
  dealFillSelect(eventArgsSet?: SceneEvent, isSelectMoving?: boolean): boolean {
    if (!eventArgsSet) {
      this.table.stateManager.updateSelectPos(-1, -1);
      return false;
    }
    const { eventArgs } = eventArgsSet;

    if (eventArgs) {
      if (eventArgs.target.name === 'checkbox') {
        return false;
      }

      // // 注意：如果启用下面这句代码逻辑 则在点击选中单元格时失效hover效果。但是会导致chart实例的click事件失效，所以先特殊处理这个逻辑
      // if (
      //   !this.table.isPivotChart() &&
      //   eventArgsSet?.eventArgs?.target.type !== 'chart' &&
      //   eventArgs.event.pointerType !== 'touch'
      // ) {
      //   this.table.stateManager.updateHoverPos(-1, -1);
      // }
      const define = this.table.getBodyColumnDefine(eventArgs.col, eventArgs.row);
      if (
        this.table.isHeader(eventArgs.col, eventArgs.row) &&
        (define?.disableHeaderSelect || this.table.stateManager.select?.disableHeader)
      ) {
        if (!isSelectMoving) {
          // 如果是点击点表头 取消单元格选中状态
          this.table.stateManager.updateSelectPos(-1, -1);
        }
        return false;
      } else if (!this.table.isHeader(eventArgs.col, eventArgs.row) && define?.disableSelect) {
        if (!isSelectMoving) {
          this.table.stateManager.updateSelectPos(-1, -1);
        }
        return false;
      }

      if (
        this.table.isPivotChart() &&
        (eventArgsSet?.eventArgs?.target.name === 'axis-label' || eventArgsSet?.eventArgs?.target.type === 'chart')
      ) {
        // 点击透视图坐标轴标签或图标内容，执行图表状态更新，不触发Select
        this.table.stateManager.updateSelectPos(-1, -1);
        return false;
      }
      console.log(this.table.stateManager.select.ranges);
      // let updateRow;
      // let updateCol;
      //    const selectRange = this.table.stateManager.select.ranges[0];
      //    const startCol = Math.min(selectRange.start.col, selectRange.end.col);
      //    const startRow = Math.min( selectRange.start.row,  selectRange.end.row);
      // const endCol = Math.max( selectRange.start.col,  selectRange.end.col);
      // const endRow = Math.max( selectRange.start.row,  selectRange.end.row);
      // // const currentRange = this.table.stateManager.select.ranges[0];
      // console.log(selectRange);
      // console.log(eventArgs.col, eventArgs.row);
      // console.log(startCol, startRow);
      // console.log(endCol, endRow);

      // if (Math.abs(startRow - eventArgs.row) > Math.abs(startCol - eventArgs.col)) {
      //    updateRow = eventArgs.row;
      //   updateCol = startCol;
      // } else {
      //       updateRow = startRow;
      //   updateCol = eventArgs.col;
      // }
      // if (eventArgs.row === startRow && eventArgs.col < startCol) {
      //   // directionOfDrag = 'left';
      //   updateRow = endRow;
      //   updateCol = eventArgs.col;
    
      // } else if (eventArgs.row === startRow && eventArgs.row === endRow &&
      //   eventArgs.col > startCol) {
      //   // directionOfDrag = 'right';
      //   updateRow = endRow;
      //   updateCol = eventArgs.col;
    
      // } else if (eventArgs.row < startRow && eventArgs.col === startCol) {
      //   // directionOfDrag = 'up';
      //   updateRow = eventArgs.row;
      //   updateCol = endCol;
    
      // } else if (eventArgs.row > startRow &&
      //   eventArgs.col === startCol) {
      //   // directionOfDrag = 'down';
      //   updateRow = eventArgs.row;
      //   updateCol = endCol;
      // }
    
      // console.log(updateRow,updateCol);

  
      this.table.stateManager.updateSelectPos(
        // updateCol,
        // updateRow,
        eventArgs.col,
        eventArgs.row,
        eventArgs.event.shiftKey,
        eventArgs.event.ctrlKey || eventArgs.event.metaKey
      );
  
    
      return true;
    }
    // this.table.stateManager.updateSelectPos(-1, -1); 这句有问题 如drag框选鼠标超出表格范围 这里就直接情况是不对的
    return false;
  }
  fillSelected(eventArgsSet?: SceneEvent, SelectCellRange?: any, SelectData?:any): any {
    console.log(SelectCellRange);
    if (!eventArgsSet) {
      this.table.stateManager.updateSelectPos(-1, -1);
      return;
    }
    const { eventArgs } = eventArgsSet;

    if (eventArgs) {
      if (eventArgs.target.name === 'checkbox') {
        return;
      }
      let direction;
      // let currentselectedrange = this.table.stateManager.select.ranges;
      console.log(eventArgs);
      console.log(Math.abs(SelectCellRange.start.row - eventArgs.row));
      console.log(Math.abs(SelectCellRange.start.col - eventArgs.col));
 if (Math.abs(SelectCellRange.start.row - eventArgs.row) >= Math.abs(SelectCellRange.start.col - eventArgs.col)) {
  console.log("??");
      if (SelectCellRange.start.row >= eventArgs.row) {
      direction = 'up';
      } else {
        direction = 'down';
        };
   
        console.log(direction);
   
 } else {
  if (SelectCellRange.start.col >= eventArgs.col) {
    direction = 'left';
    } else {
      direction = 'right';
      };
 }
 console.log(direction);
 let values: (string | number)[][] = [];
      let fillData: any[][] = [];
      let updaterow;
      let updatecol;
      // const rawData = this.table.getCopyValue();
      const rows = SelectData.split('\n'); // 将数据拆分为行
      rows.forEach(function (rowCells: any, rowIndex: number) {
        const cells = rowCells.split('\t'); // 将行数据拆分为单元格
        const rowValues: (string | number)[] = [];
        values.push(rowValues);
        cells.forEach(function (cell: string, cellIndex: number) {
          // 去掉单元格数据末尾的 '\r'
          if (cellIndex === cells.length - 1) {
            cell = cell.trim();
          }
          rowValues.push(cell);
        });
      });
      
      // if (
      //   ['up', 'left'].indexOf(direction) > -1
      // ) {
      //   values = [];

      //   if (direction === 'up') {
      //     const dragLength = eventArgs.row - startOfDragCoords.row + 1;
      //     const fillOffset = dragLength % res.length;

      //     for (let i = 0; i < dragLength; i++) {
      //       values.push(res[(i + (res.length - fillOffset)) % res.length]);
      //     }

      //   } else {
      //     const dragLength = endOfDragCoords.col - startOfDragCoords.col + 1;
      //     const fillOffset = dragLength % res[0].length;

      //     for (let i = 0; i < res.length; i++) {
      //       values.push([]);

      //       for (let j = 0; j < dragLength; j++) {
      //         values[i]
      //           .push(res[i][(j + (res[i].length - fillOffset)) % res[i].length]);
      //       }
      //     }
      //   }
      // }
      if (['up', 'left'].indexOf(direction) > -1) {
        if (direction === 'up') {
          const dragLength = SelectCellRange.start.row - eventArgs.row;
      //     for (let i = dragLength - 1; i >= 0; i--) {
      //       values.reverse().forEach(function (rowCells: any, rowIndex: number) {
      //         fillData.push(rowCells);
      //   });
      // }
      // 计算需要向上填充的行数
let fillRowCount = Math.max(dragLength - values.length, 0);

// 首先添加需要向上填充的空行
for (let i = 0; i < fillRowCount; i++) {
    let emptyRow: any[] = [];
    for (let j = 0; j < values[0].length; j++) {
        emptyRow.push(null); // 或者根据需求填充其他值
    }
    fillData.push(emptyRow);
}

// 将原始数据逆序添加到新数组中
values.reverse().forEach(function(rowCells: any[]) {
    let newRow: any[] = [];
    
    // 计算需要填充的空单元格数量
    let fillCount = Math.max(values[0].length - rowCells.length, 0);
    
    // 在新行中先添加需要填充的空单元格
    for (let i = 0; i < fillCount; i++) {
        newRow.push(null); // 或者根据需求填充其他值
    }
    
    // 将原始数据逆序添加到新行中
    rowCells.reverse().forEach(function(cellData: any) {
        newRow.push(cellData);
    });
    
    fillData.push(newRow);
});
       

        } else {
          const dragLength = SelectCellRange.start.col - eventArgs.col;
          values.forEach(function(rowCells: any[]) {
            let newRow: any[] = [];
            
            // 计算需要填充的空单元格数量
            let fillCount = Math.max(dragLength - rowCells.length, 0);
            
            // 在新行中先添加需要填充的空单元格
            for (let i = 0; i < fillCount; i++) {
                newRow.push(null); // 或者根据需求填充其他值
            }
            
            // 将原始数据逆序添加到新行中
            rowCells.reverse().forEach(function(cellData: any) {
                newRow.push(cellData);
            });
            
            fillData.push(newRow);
        });
          
       
      } 
      updaterow = eventArgs.row;
          updatecol = eventArgs.col;
    }else {
        if (direction == "down") {
          const dragLength = eventArgs.row - SelectCellRange.end.row;
          console.log(dragLength);
          // 将原始数据添加到新数组中
values.forEach(function(rowCells: any[]) {
  let newRow: any[] = [];
  
  // 将原始数据添加到新行中
  rowCells.forEach(function(cellData: any) {
      newRow.push(cellData);
  });

  fillData.push(newRow);
});

// 计算需要向下填充的行数
let fillRowCount = Math.max(dragLength - values.length, 0);

// 添加需要向下填充的空行
for (let i = 0; i < fillRowCount; i++) {
  let emptyRow: any[] = [];
  for (let j = 0; j < values[0].length; j++) {
      emptyRow.push(null); // 或者根据需求填充其他值
  }
  fillData.push(emptyRow);
}

        } else {
          const dragLength = eventArgs.col - SelectCellRange.end.col;
          values.forEach(function(rowCells: any[]) {
            let newRow: any[] = [];
            
            // 将原始数据添加到新行中
            rowCells.forEach(function(cellData: any) {
                newRow.push(cellData);
            });
        
            // 计算需要填充的空单元格数量
            let fillCount = Math.max(dragLength - rowCells.length, 0);
        
            // 在新行末尾添加需要填充的空单元格
            for (let i = 0; i < fillCount; i++) {
                newRow.push(null); // 或者根据需求填充其他值
            }
        
            fillData.push(newRow);
        });
        }

         updaterow = SelectCellRange.start.row;
          updatecol = SelectCellRange.start.col;
      //      values.forEach(function (rowCells: any, rowIndex: number) {
      //   fillData.push(rowCells);
      // })
      }
   
     
      console.log(fillData);
      (this.table as ListTableAPI).changeCellValues(updatecol, updaterow, fillData, true);


    }
   




   
  }

  deelTableSelectAll() {
    this.table.stateManager.updateSelectPos(-1, -1, false, false, true);
  }

  dealMenuSelect(eventArgsSet: SceneEvent) {
    // do nothing
  }

  checkColumnResize(eventArgsSet: SceneEvent, update?: boolean): boolean {
    // return false;
    const { eventArgs } = eventArgsSet;
    if (eventArgs) {
      const resizeCol = this.table.scenegraph.getResizeColAt(
        eventArgsSet.abstractPos.x,
        eventArgsSet.abstractPos.y,
        eventArgs.targetCell
      );
  
      if (this.table._canResizeColumn(resizeCol.col, resizeCol.row) && resizeCol.col >= 0) {
        // this.table.stateManager.updateResizeCol(resizeCol.col, eventArgsSet.abstractPos.x, first);
        // this._col = resizeCol.col;
        if (update) {
          this.table.stateManager.startResizeCol(
            resizeCol.col,
            eventArgsSet.abstractPos.x,
            eventArgsSet.abstractPos.y,
            resizeCol.rightFrozen
          );
        }
        return true;
      }
    }

    return false;
  }

  checkCellFillhandle(eventArgsSet: SceneEvent, update?: boolean): boolean {
    // return false;
    const { eventArgs } = eventArgsSet;
    if (eventArgs) {
      if (this.table.stateManager.select?.ranges?.length) {
        // if (update) {
        //   return true;
        // }
        const lastCol = this.table.stateManager.select.ranges[this.table.stateManager.select.ranges.length - 1].end.col;
        const lastRow = this.table.stateManager.select.ranges[this.table.stateManager.select.ranges.length - 1].end.row;

      const lastCellBound = this.table.scenegraph.highPerformanceGetCell(lastCol, lastRow).globalAABBBounds;
      // 计算鼠标与fillhandle矩形中心之间的距离
      const distanceX = Math.abs(eventArgsSet.abstractPos.x - lastCellBound.x2);
      const distanceY = Math.abs(eventArgsSet.abstractPos.y - lastCellBound.y2);
      const squareSize = 6 * 3;
      // 判断鼠标是否落在fillhandle矩形内
      if (this.isFilling || (distanceX <= squareSize / 2 && distanceY <= squareSize / 2)) {
        if (update) {
          console.log("123");
    
          this.isFilling = true;
       
            // const selectRange = this.table.stateManager.select.ranges[0];
            //       const endCol = Math.max( selectRange.start.col,  selectRange.end.col);
            //       const endRow = Math.max( selectRange.start.row,  selectRange.end.row);
            // this.dealFillSelect(eventArgsSet);
             
          // this.table.stateManager.isResizeCol.mouseDownOnCellCorner = true;
          // this.table.stateManager.startResizeCol(
          //   resizeCol.col,
          //   eventArgsSet.abstractPos.x,
          //   eventArgsSet.abstractPos.y,
          //   resizeCol.rightFrozen
          // );
        }
        return true;
      } 
      }
      
    }

    return false;
  }

  dealColumnResize(xInTable: number, yInTable: number) {
    this.table.stateManager.updateResizeCol(xInTable, yInTable);
  }

  chechColumnMover(eventArgsSet: SceneEvent): boolean {
    // return false;
    const { eventArgs } = eventArgsSet;

    if (
      eventArgs &&
      this.table.isHeader(eventArgs.col, eventArgs.row) &&
      checkCellInSelect(eventArgs.col, eventArgs.row, this.table.stateManager.select.ranges) &&
      // this.table.stateManager.select.cellPosStart.col === eventArgs.col &&
      // this.table.stateManager.select.cellPosStart.row === eventArgs.row &&
      this.table._canDragHeaderPosition(eventArgs.col, eventArgs.row)
    ) {
      this.table.stateManager.startMoveCol(
        eventArgs.col,
        eventArgs.row,
        eventArgsSet.abstractPos.x,
        eventArgsSet.abstractPos.y
      );
      return true;
    }

    return false;
  }

  dealColumnMover(eventArgsSet: SceneEvent) {
    const { eventArgs } = eventArgsSet;
    if (isValid(eventArgs.col) && isValid(eventArgs.row)) {
      this.table.stateManager.updateMoveCol(
        eventArgs.col,
        eventArgs.row,
        eventArgsSet.abstractPos.x,
        eventArgsSet.abstractPos.y
      );
    }
  }

  startColumnResize(eventArgsSet: SceneEvent) {
    // do nothing
  }

  dealIconClick(e: FederatedPointerEvent, eventArgsSet: SceneEvent): boolean {
    const { eventArgs } = eventArgsSet;
    // if (!eventArgs) {
    //   return false;
    // }

    const { target, event, col, row } = eventArgs || {
      target: e.target,
      event: e,
      col: -1,
      row: -1
    };
    const icon = target as unknown as Icon;

    if (icon.role && icon.role.startsWith('icon-')) {
      this.table.fireListeners(TABLE_EVENT_TYPE.ICON_CLICK, {
        name: icon.name,
        // 默认位置：icon中部正下方
        x: (icon.globalAABBBounds.x1 + icon.globalAABBBounds.x2) / 2,
        y: icon.globalAABBBounds.y2,
        col,
        row,
        funcType: icon.attribute.funcType,
        icon,
        event
      });

      return true;
    } else if (target instanceof RichText) {
      const icon = target.pickIcon(event.global);
      if (icon) {
        this.table.fireListeners(TABLE_EVENT_TYPE.ICON_CLICK, {
          name: icon.attribute.id,
          // 默认位置：icon中部正下方
          x: icon.globalX + icon.globalAABBBounds.width() / 2,
          y: icon.globalY + icon.AABBBounds.height(),
          col,
          row,
          funcType: (icon.attribute as any).funcType,
          icon: icon as unknown as Icon,
          event
        });
        return true;
      }
    }

    return false;
  }
  /** TODO 其他的事件并么有做remove */
  release() {
    this.gesture.release();

    // remove global event listerner
    this.globalEventListeners.forEach(item => {
      if (item.env === 'document') {
        document.removeEventListener(item.name, item.callback);
      } else if (item.env === 'body') {
        document.body.removeEventListener(item.name, item.callback);
      } else if (item.env === 'window') {
        window.removeEventListener(item.name, item.callback);
      }
    });
    this.globalEventListeners = [];
  }
}
