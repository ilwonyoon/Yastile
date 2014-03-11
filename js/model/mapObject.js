var MapObject = function(gameObject,index){
    this.gameObject = gameObject;
    this.id = gameObject.id;
    this.index = index;
    this.staticFrame = gameObject.getStaticFrame();

    this.left = index % Game.getLevel().width;
    this.top = Math.floor(index / Game.getLevel().width);

    // override this if you want certain tiles to move faster/slower
    this.tileSize = Game.getTileSize();
    this.tickOffset = this.tileSize/Game.getTargetTicksPerSecond();
};

MapObject.prototype.isVisible = function(scrollOffset){
    return this.left >= scrollOffset.tileX-1
        && this.left < scrollOffset.tileX+Game.getViewPort().width+1
        && this.top >= scrollOffset.tileY-1
        && this.top < scrollOffset.tileY+Game.getViewPort().height+1;
};

MapObject.prototype.render = function(step,scrollOffset){

    var x = (this.left-scrollOffset.tileX) * this.tileSize;
    var y = (this.top-scrollOffset.tileY) * this.tileSize;

    x += scrollOffset.x*step;
    y += scrollOffset.y*step;

    var baseX = x;
    var baseY = y;

    if (this.moveDirection == DIRECTION.DOWN){
        y += step*this.tickOffset;
    }

    if (this.moveDirection == DIRECTION.UP){
        y -= step*this.tickOffset;
    }

    if (this.moveDirection == DIRECTION.LEFT){
        x -= step*this.tickOffset;
    }

    if (this.moveDirection == DIRECTION.RIGHT){
        x += step*this.tickOffset;
    }

    if (this.id>0){
        var frame;
        if (this.animation){
            frame = this.gameObject.getAnimationFrame(this.animation, step + this.animationStartFrame);
        }else{
            frame = sprites[this.staticFrame];
        }

        ctx.drawImage(frame,x, y);
    }

    if (this.toplayer){
        frame = sprites[this.toplayer];
        ctx.drawImage(frame,baseX, baseY);
    }

};

MapObject.prototype.process = function(){
    if (this.processed) return;

    var me = this;
    var obj = me.gameObject;
    var targetObject;
    if (obj.inActive) return; // inanimate object, don't bother;

    if (this.id == GameObjects.PLAYER.id){
        var d, u, l, r, targetObject;

        if (Input.isDown())  d = this.moveIfPossible(DIRECTION.DOWN);
        if (Input.isUp())    u = this.moveIfPossible(DIRECTION.UP);
        if (Input.isLeft())  l = this.moveIfPossible(DIRECTION.LEFT);
        if (Input.isRight()) r = this.moveIfPossible(DIRECTION.RIGHT);

        targetObject = d || u || l || r;
        if (targetObject && targetObject.gameObject.onCollect){
            targetObject.gameObject.onCollect(targetObject);
        }

        if (!this.isMoving()){
            if (Input.isRight()){
                targetObject = this.getObject(DIRECTION.RIGHT);
                if (targetObject.gameObject.canBePushed && targetObject.gameObject.canBePushed.horizontal){
                    this.animate(ANIMATION.PUSH_RIGHT);
                    if (targetObject.canMove(DIRECTION.RIGHT) && !(targetObject.gameObject.canFall && targetObject.canMove(DIRECTION.DOWN))) {
                        Maybe(function(){
                            targetObject.move(DIRECTION.RIGHT);
                            me.move(DIRECTION.RIGHT);
                        },1-targetObject.gameObject.canBePushed.friction);

                    }
                }
            }
            if (Input.isLeft()){
                targetObject = this.getObject(DIRECTION.LEFT);
                if (targetObject.gameObject.canBePushed && targetObject.gameObject.canBePushed.horizontal){
                    this.animate(ANIMATION.PUSH_LEFT);
                    if (targetObject.canMove(DIRECTION.LEFT) && !(targetObject.gameObject.canFall && targetObject.canMove(DIRECTION.DOWN))){
                        Maybe(function(){
                            targetObject.move(DIRECTION.LEFT);
                            me.move(DIRECTION.LEFT);
                        },1-targetObject.gameObject.canBePushed.friction);

                    }
                }
            }
        }

    }else{
        if (obj.canFall) this.moveIfPossible(DIRECTION.DOWN);
        if (!this.isMoving()){
            if (obj.canFall && !this.getObject(DIRECTION.DOWN).gameObject.isStableSurface){
                var canFallLeft = this.canMove(DIRECTION.LEFTDOWN);
                var canFallRight = this.canMove(DIRECTION.RIGHTDOWN);

                if (canFallLeft && canFallRight){
                    this.move(Game.getRandomHorizontalDirection());
                }

                if (!this.isMoving()){
                    if (canFallLeft) this.move(DIRECTION.LEFT);
                    if (canFallRight) this.move(DIRECTION.RIGHT);
                }
            }
        }

    }

    if (this.wasMoving() && !this.isMoving()){
        // object stopped moving
        if (this.wasMovingToDirection == DIRECTION.DOWN){
            // object has fallen onto something;
            if (obj.onFallen) obj.onFallen(this,this.getObject(DIRECTION.DOWN))
        }
    }

    //if (!this.isMoving()){
        if (obj.eachStep) {
            obj.eachStep(this);
        }
    //}

    this.processed = true;


};

MapObject.prototype.fullStep = function(step){
    if (this.next){
        for (key in this.next){
            this[key] = this.next[key];
        }
        this.gameObject = GameObjects[this.id];
        this.staticFrame = this.gameObject.getStaticFrame();
        this.wasMovingToDirection = this.movingInToDirection;
        if (this.id == GameObjects.PLAYER.id) Map.setPlayerObject(this);
    }else{
        this.wasMovingToDirection = undefined;
    }

    if (this.animation){
        if (this.animation.length > this.animationStartFrame + step + 1){
            this.animationStartFrame = this.animationStartFrame + step + 1;
        }else{
            this.animation = false;
        }
    }

    this.reset();

    if (this.action){
        this.action(this);
        this.action = undefined;
    }
};

MapObject.prototype.reset = function(){
    this.moveDirection = undefined;
    this.next = undefined;
    this.movingInToDirection = undefined;
    this.processed = false;
};

MapObject.prototype.setNext= function(property,value){
    this.next = this.next || {};
    this.next[property] = value;
};

MapObject.prototype.getObject = function(direction){
    switch (direction){
        case DIRECTION.DOWN: return map[this.index + Game.getLevel().width]; break;
        case DIRECTION.UP: return map[this.index - Game.getLevel().width]; break;
        case DIRECTION.LEFT: return map[this.index -1]; break;
        case DIRECTION.RIGHT: return map[this.index +1]; break;
        case DIRECTION.LEFTDOWN: return map[this.index -1 + Game.getLevel().width]; break;
        case DIRECTION.RIGHTDOWN: return map[this.index +1 + Game.getLevel().width]; break;
    }
};

MapObject.prototype.canMove = function(direction){
    // object is already moving
    if (this.isMoving()) return false;

    var targetObject
    if (direction > 100){
        // combines direction
        if (direction == DIRECTION.LEFTDOWN){
            var l = this.getObject(DIRECTION.LEFT);
            var d = this.getObject(DIRECTION.LEFTDOWN);
            if (l.next || d.next) return false;
            if (this.gameObject.canMoveTo(l,DIRECTION.LEFT) && this.gameObject.canMoveTo(d,DIRECTION.DOWN)) return true;
        }
        if (direction == DIRECTION.RIGHTDOWN){
            var r = this.getObject(DIRECTION.RIGHT);
            var d = this.getObject(DIRECTION.RIGHTDOWN);
            if (r.next || d.next) return false;
            if (this.gameObject.canMoveTo(r,DIRECTION.RIGHT) && this.gameObject.canMoveTo(d,DIRECTION.DOWN)) return true;
        }
    }else{
        // targetobject is accepting a moving object
        var targetObject = this.getObject(direction);
        if (targetObject){
            if (targetObject.next && targetObject.next.id) return false;

            if (this.gameObject.canMoveTo(targetObject,direction)){
                return true;
            }
        }else{
            console.error("could not get object in direction" + direction,this);
        }

    }

    return false;

};

MapObject.prototype.canMoveLeft = function(){
    return this.canMove(DIRECTION.LEFT);
};

MapObject.prototype.canMoveRight = function(){
    return this.canMove(DIRECTION.RIGHT);
};

MapObject.prototype.canMoveUp = function(){
    return this.canMove(DIRECTION.UP);
};

MapObject.prototype.canMoveDown = function(){
    return this.canMove(DIRECTION.DOWN);
};

MapObject.prototype.isMoving = function(){
    return !!this.moveDirection;
};

MapObject.prototype.wasMoving = function(){
    return !!this.wasMovingToDirection;
};

MapObject.prototype.sameDirection = function(){
    return this.wasMovingToDirection;
};

MapObject.prototype.move = function(direction){
    this.moveDirection = direction;
    this.setNext("id",0);
    this.animate(direction);

    var targetObject = this.getObject(direction);
    targetObject.setNext("id",this.id);
    targetObject.movingInToDirection = direction;

    return targetObject;
};


MapObject.prototype.moveIfPossible = function(direction){
    if (this.canMove(direction)) {
        return this.move(direction);
    }else{
        return false;
    }
};

MapObject.prototype.moveLeftIfPossible = function(){
    this.moveIfPossible(DIRECTION.LEFT);
};
MapObject.prototype.moveRightIfPossible = function(){
    this.moveIfPossible(DIRECTION.RIGHT);
};
MapObject.prototype.moveUpIfPossible = function(){
    this.moveIfPossible(DIRECTION.UP);
};
MapObject.prototype.moveDownIfPossible = function(){
    this.moveIfPossible(DIRECTION.DOWN);
};
MapObject.prototype.animate = function(animation){

    if (typeof animation == "string" || typeof animation == "number"){
        this.animation = this.gameObject[animation];
        if (!this.animation) this.animation = this.gameObject["animation" + animation];
        if (!this.animation) this.animation = this.gameObject.animationFrames[animation];
        if (!this.animation) this.animation = this.gameObject.animationFrames["animation" + animation];
    }else{
        this.animation = animation
    }

    this.animationStartFrame = 0;
};

MapObject.prototype.isAnimating = function(){
    return this.animation;
};
MapObject.prototype.refresh = function(){
    this.setNext("id",this.id);
};

MapObject.prototype.transformInto = function(gameObject,animation,onComplete){
    this.setNext("id",gameObject.id);
    if (animation) this.animate(animation);
    if (onComplete) this.setNext("action",onComplete)
};

MapObject.prototype.addLayer = function(spriteIndex){
    this.toplayer = spriteIndex;
};

