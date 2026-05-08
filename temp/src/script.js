/* -------------------------------------------------

Dynamic cursor

--------------------------------------------------- */

const cursorSettings = {
    'class' : 'dynamicCursor',
    'size' : '18',
    'expandedSize' : '40',
    'expandSpeed' : 0.4,
    'background' : 'rgba(161, 142, 218, 0.25)',
    'opacity' : '1',
    'transitionTime' : '1.4s',
    'transitionEase' : 'cubic-bezier(0.075, 0.820, 0.165, 1.000)',
    'borderWidth' : '0',
    'borderColor' : 'black',
    'iconSize': '11px',
    'iconColor': 'white',
    'triggerElements': {
        'trigger' : {
            'className' : 'trigger',
            'icon' : '<i class="fa fa-plus"></i>'
        },
        'trigger2' : {
            'className' : 'slider_inner',
            'icon' : '<i class="fa fa-arrows-h"></i>'
        }
    }
}


function dynamicCursor(options) {

    document.write('<link rel="stylesheet" href="https://maxcdn.icons8.com/fonts/line-awesome/1.1/css/line-awesome-font-awesome.min.css">');

    var hold;
    cursor = document.createElement('div');
    let cursorIcon = document.createElement('div');

    cursorIcon.classList.add('cursorIcon');
    cursorIcon.style.position = 'absolute';
    cursorIcon.style.fontFamily = 'Raleway';
    cursorIcon.style.textTransform = 'uppercase';
    cursorIcon.style.fontWeight = '800';
    cursorIcon.style.textAlign = 'center'
    cursorIcon.style.top = '50%';
    cursorIcon.style.width = '100%';
    cursorIcon.style.transform = 'translateY(-50%)';
    cursorIcon.style.color = options.iconColor;
    cursorIcon.style.fontSize = options.iconSize;
    cursorIcon.style.opacity = 0;
    cursorIcon.style.transition = `opacity ${options.expandSpeed}s`;

    cursor.classList.add(options.class);
    cursor.style.boxSizing = 'border-box';
    cursor.style.width = `${options.size}px`;
    cursor.style.height = `${options.size}px`;
    cursor.style.borderRadius = `${options.expandedSize}px`;
    cursor.style.opacity = 0;

    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = 999;
    cursor.style.transition = `transform ${options.transitionTime} ${options.transitionEase}, width ${options.expandSpeed}s .2s, height ${options.expandSpeed}s .2s, opacity 1s .2s`;
    cursor.style.border = `${options.borderWidth}px solid ${options.borderColor}`;
    cursor.style.position = 'fixed';
    cursor.style.background = options.background;

    cursor.appendChild(cursorIcon);
    document.body.appendChild(cursor);

    setTimeout(function() {
        cursor.style.opacity = options.opacity;
    }, 500)

    var idle;

    document.onmousemove = e => {
        console.log('test')
        x = e.pageX;
        y = e.pageY;
        
        $('.slide_left').css('transform', `translateX(-${x/40}px) translateY(-${y / 40}px)`)
        $('.slide_right').css('transform', `translateX(-${x/20}px) translateY(-${y / 20}px)`)

        cursor.style.opacity = options.opacity;
        clearInterval(idle)

        idle = setTimeout(function() {
            cursor.style.opacity = 0;
        }, 4000)

        cursor.style.top = '0';
        cursor.style.left = '0';
        cursor.style.transform = `translateX(calc(${x}px - 50%)) translateY(calc(${y}px - 50%))`;
    }

    for(i in options.triggerElements) {

        let trigger = $(`.${options.triggerElements[i].className}`);

        console.log(trigger);


        let icon = options.triggerElements[i].icon;

        if(!trigger) {
            console.warn('You dont have any triggers');
        } else {
            trigger.each(function(el){

                console.log()
                trigger[el].style.cursor = 'default';
                trigger[el].addEventListener('mouseover', () => {
                    console.log('over')
                    cursor.style.width = `${options.expandedSize}px`;
                    cursor.style.height = `${options.expandedSize}px`;
                    cursorIcon.innerHTML = icon;
                    cursorIcon.style.opacity = 1;


                    console.log($(this))


                })

                trigger[el].addEventListener('mouseout', () => {
                    cursor.style.width = `${options.size}px`;
                    cursor.style.height = `${options.size}px`;
                    cursorIcon.style.opacity = 0;
                })
            })

        }
    }
}

dynamicCursor(cursorSettings);


 $(window).on('load', function () {
    setTimeout(function(){
    $('.page_slider__slide:nth-of-type(1)').addClass('active')
}, 2000)
 });

$('button').click(function(){
   let parent = $(this).parent() 
   let slide = $(this).parent().parent().parent().parent(); //Should use closest();
   let image = $(this).parent().parent().prev().find('.image');
    
    $('.page_sliderprogress__point.active').removeClass('active').next().addClass('active')
    //image.remove();
    //image.addClass('burn')
    
    setTimeout(function(){
        image.addClass('burn')
    }, 100)
    
    setTimeout(function(){
        $('.active img').hide();
        
    }, 1380)
     setTimeout(function(){
        slide.removeClass('active')
        
    }, 2100)
    
    setTimeout(function(){
       slide.next().addClass('active');
        
    }, 2400)
     
    
    parent.addClass('out');
    
    
    
})