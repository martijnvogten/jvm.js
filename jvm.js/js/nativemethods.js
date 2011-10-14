jvm.nativemethods = {};

jvm.nativemethods["jjs/browser/Console.log(Ljava/lang/Object;)V"] = function(str) {
	console.log(str);
}

jvm.nativemethods["jjs/browser/Console.log(Ljava/lang/String;)V"] = function(str) {
	if (str && typeof str == 'object') {
		str = str.fields.value.arr.join('');
	}
	console.info(str);
}

jvm.nativemethods["jjs/browser/Console.log(I)V"] = function(str) {
	console.info(str);
}

jvm.nativemethods["jjs/browser/Console.log(J)V"] = function(l) {
	console.info(l.toString(16));
}

jvm.nativemethods["jjs/browser/Console.log(D)V"] = function(str) {
	console.info(str);
}

jvm.nativemethods["jjs/browser/Window.alert(Ljava/lang/String;)V"] = function(str) {
	if (typeof str == 'object') {
		str = str.fields.value.arr.join('');
	}
	window.alert(str);
}

jvm.nativemethods["jjs/browser/Window.alert(I)V"] = function(str) {
	window.alert(str);
};

jvm.nativemethods["jjs/browser/Window.eval(Ljava/lang/String;)V"] = function(str) {
	eval(str);
};

// Object
(function() {
	
	function notify(me, all) {
		var thread = jvm.interpreter.currentThread;
		if (me.monitor !== thread) {
			debugger;
			jvm.interpreter.doThrow(jvm.interpreter.newInstance("java/lang/IllegalThreadStateException"));
			return;
		}
		if (!me.waiters) {
			return;
		}
		// Release the monitor
		thread.oldMonitorCount = me.monitorCount;
		thread.waitFor = me;
		
		var nextThread = me.waiters[0];
		if (all) {
			for(var i = 0; i < me.waiters.length; i++) {
				me.waiters[i].sleeping = false;
			}
		} else {
			nextThread.sleeping = false;
		}
		me.monitor = null;
//		me.monitor = nextThread;
//		me.monitorCount = nextThread.oldMonitorCount;
		
		jvm.interpreter.yield();
	}
	
	jvm.nativemethods["java/lang/Object.notifyAll()V"] = function(me) {
		notify(me, true);
	};
	
	jvm.nativemethods["java/lang/Object.notify()V"] = function(me) {
		notify(me, false);
	};
})();

jvm.nativemethods["java/lang/Object.wait(J)V"] = function(me, timeoutmillis) {
	var thread = jvm.interpreter.currentThread;
	if (me.monitor !== thread) {
		debugger;
		jvm.interpreter.doThrow(jvm.interpreter.newInstance("java/lang/IllegalThreadStateException"));
		return;
	}
	if (!me.waiters) {
		me.waiters = [thread];
	} else {
		me.waiters.push(thread);
	}
	thread.sleeping = true;
	thread.waitFor = me;
	thread.oldMonitorCount = me.monitorCount;
	
	// release the monitor
	me.monitor = null;
	me.monitorCount = 0;
	jvm.interpreter.yield();
	
	if (timeoutmillis > 0) {
		window.setTimeout(function() {
			thread.sleeping = false;
			jvm.interpreter.yield();
		}, timeoutmillis);
	}
}

jvm.nativemethods["java/lang/Object.registerNatives()V"] = function(me) {
	
}

jvm.nativemethods["java/lang/Object.clone()Ljava/lang/Object;"] = function(me) {
	if (me.type == 'array') {
		var clone = jvm.interpreter.newArray(me.componentClazz, me.arr.length);
		for(var i = 0; i < me.arr.length; i++) {
			clone.arr[i] = me.arr[i];
		}
		return clone;
	} else {
		var clone = jvm.interpreter.newInstance(me.clazz.name);
		clone.fields = me.fields;
		return clone;
	}
}

jvm.hashcounter = 1;

jvm.nativemethods["java/lang/Object.hashCode()I"] = function(me) {
	if (!me.hashCode) {
		me.hashCode = (123498172123123 * jvm.hashcounter++) % 0xFFFFFFFF;
	}
	return me.hashCode;
}

jvm.nativemethods["java/lang/Object.getClass()Ljava/lang/Class;"] = function(me) {
	if (typeof me == 'string') {
		return jvm.getClassClass('string', jvm.loadClass('java/lang/String'));
	}
	return jvm.getClassClass(me.type, me.type == 'array' ? me.componentClazz : me.clazz);
}

// Class
jvm.nativemethods["java/lang/Class.registerNatives()V"] = function(me) {
}

jvm.nativemethods["java/lang/Class.isInstance(Ljava/lang/Object;)Z"] = function(me, other) {
	if (!other) {
		return 0;
	}
	if (other.clazz == me.theClazz ) {
		return 1;
	}
}

jvm.nativemethods["java/lang/Class.isAssignableFrom(Ljava/lang/Class;)Z"] = function(me, other) {
	if(me.theType == 'array') {
		return (other.theType == 'array' && other.componentClass == me.componentClass) ? 1 : 0;
	}
	// other equals, extends or implements me
	var myClass = me.theClazz;
	var testClass = other.theClazz;
	while(testClass) {
		if (myClass.name == testClass.name) {
			return 1;
		}
		for(var i = 0; i < testClass.interfaces.length; i++) {
			if (testClass.interfaces[i] == myClass.name) {
				return 1;
			}
		}
		testClass = testClass.superClass ? jvm.loadClass(testClass.superClass) : null;
	}
	return 0;
}

jvm.nativemethods["java/lang/Class.getClassLoader0()Ljava/lang/ClassLoader;"] = function(me) {
	return null;
// if (!jvm.classloader) {
// jvm.classloader = jvm.interpreter.newInstance("java/lang/ClassLoader");
// }
// return jvm.classloader;
}

jvm.nativemethods["java/lang/Class.getName0()Ljava/lang/String;"] = function(me) {
	return me.theClazz ? me.theClazz.name : me.type;
}
jvm.nativemethods["java/lang/Class.forName0(Ljava/lang/String;ZLjava/lang/ClassLoader;)Ljava/lang/Class;"] = function(cls, loader) {
	cls = (typeof cls == 'string' ? cls : cls.fields.value.arr.join(""));
	return jvm.getClassClass('object', jvm.loadClass(cls.replace(/\./g, "/")));
}

jvm.nativemethods["java/lang/Class.isArray()Z"] = function(me) {
	return me.theType == 'array' ? 1 : 0;
}

jvm.nativemethods["java/lang/Class.isInterface()Z"] = function(me) {
	return (me.theType !== 'array' && me.theClazz && (me.theClazz.access_flags & 0x0200)) ? 1 : 0;
}

jvm.nativemethods["java/lang/Class.getDeclaredConstructors0(Z)[Ljava/lang/reflect/Constructor;"] = function(me, publicOnly) {
	var methods = me.theClazz.methods;
	var array = jvm.interpreter.newArray(jvm.loadClass("java/lang/reflect/Constructor"), 0);
	for(var name in methods) {
		if (!name.match(/^<init>.*/)) {
			continue;
		}
		var m = jvm.interpreter.newInstance("java/lang/reflect/Constructor");
		m.fields.theMethod = methods[name];
		m.fields.name = methods[name].name;
		m.fields.modifiers = methods[name].access_flags;
		m.fields.clazz = me;
		
		var exceptionTypes = jvm.interpreter.newArray(jvm.loadClass("java/lang/Class"), 0);
		m.fields.exceptionTypes = exceptionTypes;
		
		var parameterTypes = jvm.interpreter.newArray(jvm.loadClass("java/lang/Class"), 0);
		for(var i = 0; i < methods[name].paramTypes.length; i++) {
			var type = methods[name].paramTypes[i];
			parameterTypes.arr.push(jvm.getClassFromDescriptor(type));
		}
		m.fields.parameterTypes = parameterTypes;
		array.arr.push(m);
	}
	return array;
}

jvm.nativemethods["java/lang/Class.getDeclaredMethods0(Z)[Ljava/lang/reflect/Method;"] = function(me, publicOnly) {
	var methods = me.theClazz.methods;
	var array = jvm.interpreter.newArray(jvm.loadClass("java/lang/reflect/Method"), 0);
	for(var name in methods) {
		if (name.match(/^<(cl)?init>.*/)) {
			continue;
		}
		var m = jvm.interpreter.newInstance("java/lang/reflect/Method");
		m.fields.theMethod = methods[name];
		m.fields.name = methods[name].name;
		m.fields.clazz = me;
		m.fields.returnType = methods[name].returnType ? jvm.getClassFromDescriptor(methods[name].returnType) : null;
		
		var exceptionTypes = jvm.interpreter.newArray(jvm.loadClass("java/lang/Class"), 0);
		m.fields.exceptionTypes = exceptionTypes;
		
		var parameterTypes = jvm.interpreter.newArray(jvm.loadClass("java/lang/Class"), 0);
		for(var i = 0; i < methods[name].paramTypes.length; i++) {
			var type = methods[name].paramTypes[i];
			parameterTypes.arr.push(jvm.getClassFromDescriptor(type));
		}
		m.fields.parameterTypes = parameterTypes;
		array.arr.push(m);
	}
	return array;
}

jvm.nativemethods["java/lang/Class.getInterfaces()[Ljava/lang/Class;"] = function(me) {
	var interfaces = me.theClazz.interfaces;
	var array = jvm.interpreter.newArray(jvm.loadClass("java/lang/Class"), 0);
	for(var i = 0; i < interfaces.length; i++) {
		array.arr.push(jvm.getClassClass('object', jvm.loadClass(interfaces[i])));
	}
	return array;
}

jvm.nativemethods["java/lang/Class.isPrimitive()Z"] = function(me) {
	return (me.theClazz != null || me.theType == 'array') ? 0 : 1;
}

jvm.nativemethods["java/lang/Class.getDeclaredFields0(Z)[Ljava/lang/reflect/Field;"] = function(me, publicOnly) {
	var fields = me.theClazz.fields;
	var array = jvm.interpreter.newArray(jvm.loadClass("java/lang/reflect/Field"), 0);
	for(var name in fields) {
		var f = jvm.interpreter.newInstance("java/lang/reflect/Field");
		f.theField = fields[name];
		f.fields.name = fields[name].name;
		f.fields.modifiers = fields[name].access_flags;
		f.fields.clazz = me;
		f.fields.type = jvm.getClassFromDescriptor(fields[name].descriptor)
		array.arr.push(f);
	}
	return array;
}

jvm.nativemethods["java/lang/Class.getPrimitiveClass(Ljava/lang/String;)Ljava/lang/Class;"] = function(str) {
	return jvm.getPrimitiveClass(str);
}

jvm.nativemethods["java/lang/Class.getComponentType()Ljava/lang/Class;"] = function(me) {
	return me.theType == 'array' ? me.componentClass : null;
}

jvm.nativemethods["java/lang/Class.desiredAssertionStatus0(Ljava/lang/Class;)Z"] = function(cls) {
	return 1;
}

// String
jvm.nativemethods["java/lang/String.intern()Ljava/lang/String;"] = function(me) {
	return me;
}

// Math
jvm.nativemethods["java/lang/StrictMath.cos(D)D"] = function(d) {
	return Math.cos(d);
}

// ClassLoader
jvm.nativemethods["java/lang/ClassLoader.registerNatives()V"] = function() {
}

// Unsafe

jvm.unsafe = {};
jvm.unsafe.fieldoffsetcounter = 501;
jvm.unsafe.fieldnames_by_offset = {};
jvm.unsafe.fieldoffsets_by_field = {};

jvm.nativemethods["sun/misc/Unsafe.allocateMemory(J)J"] = function() {
	return Long.fromNumber(123);
}

jvm.nativemethods["sun/misc/Unsafe.putLong(JJ)V"] = function() {
}

jvm.nativemethods["sun/misc/Unsafe.park(ZJ)V"] = function() {
	jvm.interpreter.currentThread.sleeping = true;
}

jvm.nativemethods["sun/misc/Unsafe.putObject(Ljava/lang/Object;JLjava/lang/Object;)V"] = function() {
}

jvm.nativemethods["sun/misc/Unsafe.getByte(J)B"] = function() {
	return 1;
}

jvm.nativemethods["sun/misc/Unsafe.freeMemory(J)V"] = function() {
}

jvm.nativemethods["sun/misc/Unsafe.registerNatives()V"] = function() {
}

jvm.nativemethods["sun/misc/Unsafe.compareAndSwapObject(Ljava/lang/Object;JLjava/lang/Object;Ljava/lang/Object;)Z"] = 
jvm.nativemethods["sun/misc/Unsafe.compareAndSwapInt(Ljava/lang/Object;JII)Z"] = function(me, target, offset, offset_2, expect, update) {
	var fieldname = jvm.unsafe.fieldnames_by_offset[offset];
	if (!fieldname) {
		debugger;
	}
	var doit = (target.fields[fieldname] == expect)
	if (doit) {
		target.fields[fieldname] = update;
	}
	return doit ? 1 : 0;
}

jvm.nativemethods["sun/misc/Unsafe.getObjectVolatile(Ljava/lang/Object;J)Ljava/lang/Object;"] = function() {
	return null;
}

jvm.nativemethods["sun/misc/Unsafe.staticFieldBase(Ljava/lang/reflect/Field;)Ljava/lang/Object;"] = function() {
	return null;
}
	
jvm.nativemethods["sun/misc/Unsafe.arrayIndexScale(Ljava/lang/Class;)I"] = function() {
	return 1;
}
jvm.nativemethods["sun/misc/Unsafe.arrayBaseOffset(Ljava/lang/Class;)I"] = function() {
	return 0;
}

jvm.nativemethods["sun/misc/Unsafe.staticFieldOffset(Ljava/lang/reflect/Field;)J"] = 
jvm.nativemethods["sun/misc/Unsafe.objectFieldOffset(Ljava/lang/reflect/Field;)J"] = function(me, field) {
	if (!jvm.unsafe.fieldoffsets_by_field[field.fields.name]) {
		var offset = jvm.unsafe.fieldoffsetcounter++;
		jvm.unsafe.fieldnames_by_offset[offset] = field.fields.name;
		jvm.unsafe.fieldoffsets_by_field[field.fields.name] = offset;
	}
	return Long.fromNumber(jvm.unsafe.fieldoffsets_by_field[field.fields.name]);
}

jvm.nativemethods["sun/misc/Unsafe.ensureClassInitialized(Ljava/lang/Class;)V"] = function(me, cls) {
// console.log("Ensure class initialized ", cls)
}

// AtomicLong
jvm.nativemethods["java/util/concurrent/atomic/AtomicLong.VMSupportsCS8()Z"] = function() {
	return 0;
}


// Reflection
jvm.nativemethods["sun/reflect/Reflection.getCallerClass(I)Ljava/lang/Class;"] = function() {
	var instance = jvm.getClassClass('object', jvm.loadClass("java/lang/Object"));
	return instance;
}

jvm.nativemethods["sun/reflect/Reflection.getClassAccessFlags(Ljava/lang/Class;)I"] = function(clazz) {
	return clazz.theClazz.access_flags;
}

jvm.nativemethods["java/lang/Class.getModifiers()I"] = function(me) {
	return me.theClazz.access_flags;
}

jvm.nativemethods["java/lang/Class.getSuperclass()Ljava/lang/Class;"] = function(me) {
	return me.theClazz.superClass ? jvm.getClassClass('object', jvm.loadClass(me.theClazz.superClass)) : null;
}

jvm.nativemethods["sun/reflect/NativeMethodAccessorImpl.invoke0(Ljava/lang/reflect/Method;Ljava/lang/Object;[Ljava/lang/Object;)Ljava/lang/Object;"] = function(method, instance, args) {
// for(var i = 0; i < cstructor.fields.parameterTypes.arr.length; i++) {
// paramTypes +=
// jvm.getDescriptorFromClass(cstructor.fields.parameterTypes.arr[i]);
// }
	var ret;
	if (instance) {
		var locals = [instance];
		ret = jvm.interpreter.invokeFirst(instance.clazz, method.theMethod, args);
	} else {
		var clazz = method.fields.clazz.theClazz;
		var m = null;
		for(var name in clazz.methods) {
			if (name.substring(0, name.indexOf("(")) == method.fields.name) {
				m = clazz.methods[name];
			}
		}
		if (!m) {
			debugger;
		}
		ret = jvm.interpreter.invokeStatic(method.fields.clazz.theClazz, m);
	}
	if (ret === undefined) {
		return null;
	}
	return ret;
}

jvm.nativemethods["sun/reflect/NativeConstructorAccessorImpl.newInstance0(Ljava/lang/reflect/Constructor;[Ljava/lang/Object;)Ljava/lang/Object;"] = function(cstructor, args) {
	var instance = jvm.interpreter.newInstance(cstructor.fields.clazz.theClazz.name);
	var locals = [instance];
	if (args) {
		for(var i = 0; i < args.arr.length; i++) {
			locals.push(args.arr[i]);
		}
	}
	var paramTypes = "";
	for(var i = 0; i < cstructor.fields.parameterTypes.arr.length; i++) {
		paramTypes += jvm.getDescriptorFromClass(cstructor.fields.parameterTypes.arr[i]);
	}
	jvm.interpreter.invokeFirst(instance.clazz, instance.clazz.methods["<init>(" + paramTypes + ")V"], locals);
	return instance;
}

// java/lang/reflect/Array
jvm.nativemethods["java/lang/reflect/Array.newArray(Ljava/lang/Class;I)Ljava/lang/Object;"] = function(me, clazz, count) {
	return jvm.interpreter.newArray(clazz, count);
}

jvm.nativemethods["java/lang/System.arraycopy(Ljava/lang/Object;ILjava/lang/Object;II)V"] = function(src, srcPos, dest, destPos, length) {
	for(var i = 0; i < length; i++) {
		dest.arr[destPos++] = src.arr[srcPos++];
	}
}

jvm.nativemethods["java/lang/System.setOut0(Ljava/io/PrintStream;)V"] = function(it) {
	jvm.classes["java/lang/System"].fieldvalues.out = it;
}

jvm.nativemethods["java/lang/System.setIn0(Ljava/io/InputStream;)V"] = function(it) {
	jvm.classes["java/lang/System"].fieldvalues['in'] = it;
}

jvm.nativemethods["java/lang/System.setErr0(Ljava/io/PrintStream;)V"] = function(it) {
	jvm.classes["java/lang/System"].fieldvalues.err = it;
}

jvm.nativemethods["java/lang/System.identityHashCode(Ljava/lang/Object;)I"] = function(it) {
	if (!it.hashCode) {
		it.hashCode = (123498172123123 * jvm.hashcounter++) % 0xFFFFFFFF;
	}
	return it.hashCode;
}

// Signal
jvm.nativemethods["sun/misc/Signal.findSignal(Ljava/lang/String;)I"] = function(it) {
// console.log("findSignal", it)
	return 1;
}

// Signal
jvm.nativemethods["sun/misc/Signal.handle0(IJ)J"] = function(i, l, l2) {
// console.log("handle", i, l, l2)
	return Long.fromNumber(1);
}

jvm.nativemethods["java/lang/System.initProperties(Ljava/util/Properties;)Ljava/util/Properties;"] = function(props) {
	function setProperty(name, value) {
		jvm.interpreter.invokeFirst(props.clazz, props.clazz.methods["setProperty(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/Object;"], [props, name, value]);
	}
	setProperty("os.name", "Mac OS X");
	setProperty("file.separator", "/");
	setProperty("java.home", "/JAVA_HOME");
	setProperty("sun.boot.class.path", "/bin");
	setProperty("user.dir", "/USER_DIR");
	setProperty("user.home", "/USER_HOME");
	setProperty("java.io.tmpdir", "/TMP");
	setProperty("user.country", "US");
	setProperty("sun.io.useCanonCaches", "false");
	setProperty("sun.io.useCanonPrefixCache", "false");
	setProperty("java.library.path", "/");
	setProperty("sun.boot.library.path", "/");
	setProperty("file.encoding", "UTF-8");
	setProperty("line.separator", "\n");
	return props;
}

// System
jvm.nativemethods["java/lang/System.registerNatives()V"] = function() {
}

jvm.nativemethods["java/lang/System.mapLibraryName(Ljava/lang/String;)Ljava/lang/String;"] = function(name) {
	return "awt";
}

jvm.nativemethods["java/lang/System.currentTimeMillis()J"] = function() {
	return Long.fromNumber(new Date().getTime());
}

// Float
jvm.nativemethods["java/lang/Float.intBitsToFloat(I)F"] = function(b) {
	
	if (b == 0) return 0;
	if (b == 0x7f800000) return Number.POSITIVE_INFINITY;
	if (b == 0xff800000) return Number.NEGATIVE_INFINITY;
	if ((b >= 0x7f800001 && b <= 0x7fffffff) || (b > 0xff800001 && b <= 0xffffffff)) return NaN;
	
	var s = ((b >> 31) == 0) ? 1 : -1;
	var e = ((b >> 23) & 0xff);
	var m = (e == 0) ?
		(b & 0x7fffff) << 1 :
		(b & 0x7fffff) | 0x800000;
	return s * m * Math.pow(2, e - 150);
}

jvm.nativemethods["java/lang/Float.floatToRawIntBits(F)I"] = function(f) {
	if (f == 0) return 0;
	if (f == Number.POSITIVE_INFINITY) return 0x7f800000;
	if (f == Number.NEGATIVE_INFINITY) return 0xff800000;
	if (f == NaN) return 0x7fc00000;
	
	var exp = 150;
	
	var positive = f > 0;
	if (!positive) {
		f = -f;
	}
	
	while(f > 0x800000) {
		exp++;
		f = f / 2;
	}
	
	while (f <= 0x800000) {
		exp --;
		f = f * 2;
	}
	
	return (positive ? 0 : 0x80000000) + (exp << 23) + Math.floor(f - 0x800000);
}

// Double
jvm.nativemethods["java/lang/Double.longBitsToDouble(J)D"] = function(val) {
	var h = val.high_;
	var l = val.low_;
	if (h == 0 && l == 0) return 0;
	if (h == 0x7ff00000 && l == 0) return Number.POSITIVE_INFINITY;
	if (h == 0xfff00000 && l == 0) return Number.NEGATIVE_INFINITY;
	if (h > 0x7ff00000 && h <= 0x7fffffff) return NaN;
	if (h > 0xfff00000 && h <= 0xffffffff) return NaN;
	var s = ((h >> 31) == 0) ? 1 : -1;
	var e = ((h >> 20) & 0x7ff);
	var m = (e == 0) ?
		(((h & 0xfffff)) + h * Math.pow(2, -32)) << 1 :
		((h & 0xfffff | 0x100000) + (l * Math.pow(2, -32)));
	return s * m * Math.pow(2, e - 1043);
}

jvm.nativemethods["java/lang/Double.doubleToRawLongBits(D)J"] = function(d, d0) {
	if (d == 0) {
		return Long.fromNumber(0);
	}
	if (d == Number.POSITIVE_INFINITY) {
		return new Long(0, 0x7ff00000);
	}
	if (d == Number.NEGATIVE_INFINITY) {
		return new Long(0, 0xfff00000);
	}
	if (d == NaN) {
		return new Long(0, 0x7ff80000);
	}
	
	var exp = 1075;
	var positive = d > 0;
	if (!positive) {
		d = -d;
	}
	while (d > 0x0010000000000000) {
		exp ++;
		d = d / 2;
	}
	while (d <= 0x0010000000000000) {
		exp --;
		d = d * 2;
	}
	
	var l = Long.fromNumber(exp).shiftLeft(52).add(Long.fromNumber(d - 0x0010000000000000));
	if (!positive) {
		l.or(new Long(0, 0x8000000));
	}
	return l;
}

jvm.nativemethods["java/lang/Throwable.getStackTraceElement(I)Ljava/lang/StackTraceElement;"] = function(me, index) {
	var el = jvm.interpreter.newInstance("java/lang/StackTraceElement");
	el.fields.declaringClass = me.theTrace[index].declaringClass;
	el.fields.methodName = me.theTrace[index].methodName;
	el.fields.fileName = "";
	el.fields.lineNumber = -1;
	return el;
}

jvm.nativemethods["java/lang/Throwable.getStackTraceDepth()I"] = function(me) {
	return me.theTrace.length;
}

jvm.nativemethods["java/lang/Throwable.fillInStackTrace()Ljava/lang/Throwable;"] = function(me) {
	me.theTrace = [];
	var frames = jvm.interpreter.currentThread.frames;
	for(var i = frames.length - 2; i > -1; --i) {
		var f = frames[i];
		me.theTrace.push({
			declaringClass: f.clazz.name,
			methodName: f.method.name
		});
	}
}


// Runtime
jvm.nativemethods["java/lang/Runtime.freeMemory()J"] = function() {
	return Long.fromNumber(128 * 1000 * 1000);
};

jvm.nativemethods["java/lang/Runtime.totalMemory()J"] = function() {
	return Long.fromNumber(256 * 1000 * 1000);
};

jvm.nativemethods["java/lang/Runtime.availableProcessors()I"] = function() {
	return 1;
};

// VM
jvm.nativemethods["sun/misc/VM.initialize()V"] = function() {
}

jvm.nativemethods["sun/misc/VM.getThreadStateValues([[I[[Ljava/lang/String;)V"] = function(ints, strings) {
	var index = 0;
	function addValue(stateint, statename) {
		var intval = jvm.interpreter.newArray('T_INT', 1);
		intval.arr[0] = stateint;
		ints.arr[index] = intval;
		
		var stringval = jvm.interpreter.newArray("java/lang/String", 1);
		stringval.arr[0] = statename;
		strings.arr[index++] = stringval;
		
	}
	var jvmstates = ["NEW", "RUNNABLE", "BLOCKED", "WAITING", "TIMED_WAITING", "TERMINATED"];
	for(var i = 0; i < jvmstates.length; i++) {
		addValue(0, "NEW");
		addValue(1, "RUNNABLE");
		addValue(2, "BLOCKED");
		addValue(3, "WAITING");
		addValue(4, "TIMED_WAITING");
		addValue(5, "TERMINATED");
	}
}


// FileSystem
jvm.nativemethods["java/io/FileSystem.getFileSystem()Ljava/io/FileSystem;"] = function() {
	var fs = jvm.interpreter.newInstance("java/io/UnixFileSystem");
	fs.fields.slash = "/";
	fs.fields.colon = ":";
	return fs;
}

// jvm.nativemethods["java/io/FileSystem.getSeparator()C"] = function() {
// return "/";
// }
//
// jvm.nativemethods["java/io/FileSystem.getPathSeparator()C"] = function() {
// return ":";
// }
//
// jvm.nativemethods["java/io/FileSystem.getDefaultParent()Ljava/lang/String;"]
// = function() {
// return "/";
// }


// jvm.nativemethods["java/io/FileSystem.normalize(Ljava/lang/String;)Ljava/lang/String;"]
// = function(me, it) {
// console.log("normalize", it);
// return it;
// }
//
// jvm.nativemethods["java/io/FileSystem.resolve(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;"]
// = function(me, it, it2) {
// console.log("resolve", it, it2);
// return it;
// }

// AccessController
jvm.nativemethods["java/security/AccessController.getStackAccessControlContext()Ljava/security/AccessControlContext;"] = function(action) {
	return null;
}

jvm.nativemethods["java/security/AccessController.doPrivileged(Ljava/security/PrivilegedAction;)Ljava/lang/Object;"] = function(action) {
	return jvm.interpreter.invokeFirst(action.clazz, action.clazz.methods["run()Ljava/lang/Object;"], [action]);
}

jvm.nativemethods["java/security/AccessController.doPrivileged(Ljava/security/PrivilegedExceptionAction;)Ljava/lang/Object;"] = function(action) {
	return jvm.interpreter.invokeFirst(action.clazz, action.clazz.methods["run()Ljava/lang/Object;"], [action]);
}

jvm.nativemethods["java/security/AccessController.doPrivileged(Ljava/security/PrivilegedExceptionAction;Ljava/security/AccessControlContext;)Ljava/lang/Object;"] = function(action) {
	return jvm.interpreter.invokeFirst(action.clazz, action.clazz.methods["run()Ljava/lang/Object;"], [action]);
}

jvm.nativemethods["java/security/AccessController.doPrivileged(Ljava/security/PrivilegedAction;Ljava/security/AccessControlContext;)Ljava/lang/Object;"] = function(action) {
	return jvm.interpreter.invokeFirst(action.clazz, action.clazz.methods["run()Ljava/lang/Object;"], [action]);
}

// Thread
jvm.nativemethods["java/lang/Thread.isInterrupted(Z)Z"] = function(me) {
	return 0;
}

jvm.nativemethods["java/lang/Thread.interrupt0()V"] = function(me) {
	if (me.theThread.sleeping) {
		if (me.theThread.sleeptimer) {
			window.clearTimeout(me.theThread.sleeptimer);
			me.theThread.sleeptimer = null;
		}
		me.theThread.sleeping = false;
		me.theThread.__thrown = jvm.interpreter.newInstance("java/lang/InterruptedException");
		jvm.interpreter.yield();
	} else {
		me.theThread.interrupted = true;
	}
};

jvm.nativemethods["java/lang/Thread.sleep(J)V"] = function(millis) {
	var thread = jvm.interpreter.currentThread;
	
	thread.sleeping = true;
	jvm.interpreter.yield();
	
	thread.sleeptimer = window.setTimeout(function() {
		thread.sleeping = false;
		jvm.interpreter.yield();
	}, millis);
};

jvm.nativemethods["java/lang/Thread.registerNatives()V"] = function() {
};

jvm.nativemethods["java/lang/Thread.setPriority0(I)V"] = function() {
};

jvm.nativemethods["java/lang/Thread.isAlive()Z"] = function() {
	return 0;
};

jvm.nativemethods["java/lang/Thread.start0()V"] = function(me) {
	me.fields.me = me;
	me.fields.threadStatus = 1;
	console.log("Starting thread " + me.fields.name.arr.join(''));
	if (me.fields.name.arr.join('') == "Reference Handler") {
		// Just leave this one..
		// Weak references don't exist in this world.
	} else {
		me.theThread = jvm.interpreter.startThread(me.clazz, me.clazz.methods['run()V'], [me]);
	}
};

jvm.nativemethods["java/lang/Thread.currentThread()Ljava/lang/Thread;"] = function() {
	if (!jvm.interpreter.currentThread.javaThreadObject) {
		var o = jvm.interpreter.newInstance("java/lang/Thread");
		var group = jvm.interpreter.newInstance("java/lang/ThreadGroup");
		group.fields.maxPriority = 10;
		o.fields.group = group;
		o.fields.priority = 1;
		o.fields.daemon = 0;
		o.fields.tid = Long.fromNumber(1);
		o.fields.threadStatus = 1;
		var name = jvm.interpreter.newArray('T_CHAR', 4);
		name.arr = ['m', 'a', 'i', 'n'];
		o.fields.name = name;
		o.theThread = jvm.interpreter.currentThread;
		jvm.interpreter.currentThread.javaThreadObject = o;
	}
	return jvm.interpreter.currentThread.javaThreadObject;
}

// ObjectStreamClass
jvm.nativemethods["java/io/ObjectStreamClass.initNative()V"] = function() {
}

jvm.nativemethods["java/util/TimeZone.getSystemGMTOffsetID()Ljava/lang/String;"] = function() {
	return "GMT+01:00";
}

jvm.nativemethods["java/util/TimeZone.getSystemTimeZoneID(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;"] = function() {
	return "Europe/Amsterdam";
}

// UnixFileSystem
jvm.nativemethods["java/io/UnixFileSystem.createFileExclusively(Ljava/lang/String;)Z"] = function() {
	console.log("Create file exclusively", arguments[0])
};

jvm.nativemethods["java/io/UnixFileSystem.list(Ljava/io/File;)[Ljava/lang/String;"] = function() {
	return jvm.interpreter.newArray(jvm.loadClass("java/lang/String"), 0);
};
jvm.nativemethods["java/io/UnixFileSystem.initIDs()V"] = function() {};

jvm.files = {
		"/JAVA_HOME/lib/zi/Europe/Amsterdam": {
			
		},
		"/JAVA_HOME/lib/zi/ZoneInfoMappings": {
			
		},
		"/awt": {
			isDirectory: true
		},
		"/bin": {
			isDirectory: true
		},
		"/bin/jline": {
			isDirectory: true
		},
		"/bin/jline/CandidateListCompletionHandler.properties": {
			
		},
		"/bin/test.properties": {
		},
		"/USER_DIR/words.txt": {
			
		}
}


jvm.nativemethods["java/io/UnixFileSystem.getLength(Ljava/io/File;)J"] = function(me, file) {
	var path = file.fields.path;
	path = (typeof path == 'string' ? path : path.fields.value.arr.join(""));
	var f = jvm.files[path];
	if (!f.bytes) {
		f.bytes = jvm.fetchBytes("files" + path);
	}
	console.log("getlength", f.bytes.length);
	return Long.fromNumber(f.bytes.length);
}

jvm.nativemethods["java/io/UnixFileSystem.getBooleanAttributes0(Ljava/io/File;)I"] = function(me, file) {
	console.log("getbooleanattributes", file.fields.path);
// public static final int BA_EXISTS = 0x01;
// public static final int BA_REGULAR = 0x02;
// public static final int BA_DIRECTORY = 0x04;
// public static final int BA_HIDDEN = 0x08;
	var path = file.fields.path;
	path = (typeof path == 'string' ? path : path.fields.value.arr.join(""));
// console.log("getBooleanAtributes", path);
	if (!jvm.files[path]) {
		return 0;
	} else {
		return 0x03 + (jvm.files[path].isDirectory ? 0x04 : 0);
	}
}

jvm.nativemethods["java/io/UnixFileSystem.canonicalize0(Ljava/lang/String;)Ljava/lang/String;"] = function(me, file) {
	var str = (typeof file == 'string' ? file : file.fields.value.arr.join(""));
	return str.substring(0, 1) == "/" ? str : "/" + str;
}

// FileOutputStream
jvm.nativemethods["java/io/FileOutputStream.initIDs()V"] = function(me) {
}

jvm.nativemethods["java/io/FileOutputStream.writeBytes([BII)V"] = function(me, bytes, start, len) {
	var buf = []
	for(var i = start; i < start+len; i++) {
		buf.push(String.fromCharCode(bytes.arr[i]));
	}
	$("body").append($("<span>").css("white-space", "pre").text(buf.join('')));
}

// FileInputStream
jvm.nativemethods["java/io/FileInputStream.initIDs()V"] = function(me) {
}

jvm.nativemethods["java/io/FileInputStream.open(Ljava/lang/String;)V"] = function(me, str) {
	str = (typeof str == 'string' ? str : str.fields.value.arr.join(""));
	if (str[0] != "/") {
		str = "/USER_DIR/" + str;
	}
	var f = jvm.files[str];
	if (!f) {
		jvm.interpreter.doThrow(jvm.interpreter.newInstance("java/io/FileNotFoundException"));
		return;
	}
	if (!f.bytes) {
		f.bytes = jvm.fetchBytes(str.substring(1));
	}
	me.filepos = 0;
	me.filebytes = f.bytes;
// console.log("fileinputstream.open ", str);
}

jvm.nativemethods["java/io/FileInputStream.close0()V"] = function(me) {
	console.log("Close!");
	me.filepos = 0;
// console.log("fileinputstream.close ", me);
}

jvm.nativemethods["java/io/FileInputStream.read()I"] = function(me) {
	if (me.filepos > (me.filebytes.length - 1)) {
		return -1;
	}
	return me.filebytes[me.filepos++];
}

jvm.nativemethods["java/io/FileInputStream.available()I"] = function(me) {
	console.log("available", (me.filebytes.length - me.filepos));
	return me.filebytes.length - me.filepos;
}

var keys = [];
jvm.nativemethods["java/io/FileInputStream.readBytes([BII)I"] = function(me, targetarr, start, length) {
	if (me.fields.fd.fields.fd == 0) {
		// System.in
		// wait for keystrokes.
		if (keys.length == 0) {
			var listener = function(evt) {
				if(evt.charCode) {
					keys.push(evt.charCode);
				}
				if (evt.keyCode == 13) {
					keys.push(10);
					document.removeEventListener('keypress', listener);
					var thread = jvm.interpreter.currentThread;
					thread.sleeping = false;
					jvm.interpreter.yield();
				}
			}
			document.addEventListener('keypress', listener);
			return jvm.interpreter.__block;
		} else {
			for(var i = 0; i < keys.length && i < length; i++) {
				targetarr.arr[start + i] = keys.shift();
			}
			return i;
		}
	}
	if(me.filepos >= me.filebytes.length) {
		return -1;
	}
	var startpos = me.filepos;
	for(var i = start; me.filepos < me.filebytes.length && i < start + length; i++) {
		targetarr.arr[i] = me.filebytes[me.filepos++];
	}
	console.log("returning", me.filepos - startpos);
	return me.filepos - startpos;
}

// FileDescriptor
jvm.nativemethods["java/io/FileDescriptor.initIDs()V"] = function(me) {
}

// ResourceBundle
jvm.nativemethods["java/util/ResourceBundle.getClassContext()[Ljava/lang/Class;"] = function() {
	var objClass = jvm.getClassClass("object", jvm.loadClass("java/lang/Object"));
	var arr = jvm.interpreter.newArray(jvm.loadClass("java/lang/Class"), 3);
	arr.arr = [objClass, objClass, objClass];
	return arr;
}

// Debug
jvm.nativemethods["jjs/browser/Debugger.debug()V"] = function(me) {
	debugger;
}

// Classloader
jvm.nativemethods["java/lang/ClassLoader.findLoadedClass0(Ljava/lang/String;)Ljava/lang/Class;"] = function(me, str) {
	if (str && typeof str == 'object') {
		str = str.fields.value.arr.join('');
	}
	return jvm.getClassClass('object', jvm.loadClass(str.replace(/\./g, "/")));
}

jvm.nativemethods["java/lang/ClassLoader$NativeLibrary.load(Ljava/lang/String;)V"] = function(me, str) {
	me.fields.handle = Long.fromNumber(1);
}

jvm.nativemethods["java/lang/ClassLoader.findBootstrapClass(Ljava/lang/String;)Ljava/lang/Class;"] = function(me, str) {
	if (str && typeof str == 'object') {
		str = str.fields.value.arr.join('');
	}
	return jvm.getClassClass('object', jvm.loadClass(str.replace(/\./g, "/")));
}

// Console
jvm.nativemethods["java/io/Console.istty()Z"] = function() {
	return 1;
};

jvm.nativemethods["java/io/Console.encoding()Ljava/lang/String;"] = function() {
	return "UTF-8";
};

// Cruft
jvm.nativemethods["com/apple/java/AppleSystemLog.initASLNative()Z"] = function() {};

// ProcessEnvironment
jvm.nativemethods["java/lang/ProcessEnvironment.environ()[[B"] = function() {
	var arrayobject = this.newArray(jvm.getClassFromDescriptor("[[B"), 0);
	return arrayobject;
//	for(var i = 0; i < counts[0]; i++) {
//		arrayobject.arr[i] = this.newArray(jvm.getClassFromDescriptor(cls.substring(1)), counts[1]);
//	}
};

// UNIXProcess
jvm.nativemethods["java/lang/UNIXProcess.initIDs()V"] = function() {
};

jvm.nativemethods["java/lang/UNIXProcess.forkAndExec([B[BI[BI[BZLjava/io/FileDescriptor;Ljava/io/FileDescriptor;Ljava/io/FileDescriptor;)I"] = 
	function() {
	debugger;
};

// InetAddress
jvm.nativemethods["java/net/Inet4Address.init()V"] = function() {};
jvm.nativemethods["java/net/InetAddress.init()V"] = function() {};

jvm.nativemethods["java/net/Inet4AddressImpl.getLocalHostName()Ljava/lang/String;"] = function() {
	return "localhost";
}

jvm.nativemethods["java/net/InetAddressImplFactory.isIPv6Supported()Z"] = function() {
	return 0;
}
