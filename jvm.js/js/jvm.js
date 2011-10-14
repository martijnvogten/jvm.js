var jvm = {};
jvm.classes= {};
jvm.verbose = true;

jvm.loadClass = function(className) {
	if (jvm.classes[className])
		return jvm.classes[className];
	
	if (className[0] == "[") {
		className = "java/lang/reflect/Array";
	}
	if (jvm.classes[className]) {
		return jvm.classes[className];
	} else {
		var clazz = jvm.loadClassFile(className);
		if(clazz.superClass) {
			jvm.loadClass(clazz.superClass);
		}
		if (clazz.methods["<clinit>()V"]) {
			jvm.interpreter.invokeFirst(clazz, clazz.methods["<clinit>()V"]);			
		}
		return clazz;
	}
}

jvm.loadClassFile = function(className) {
	if (!className) {
		debugger;
	}
	var bytes;
	if ("scala/" == className.substring(0,6)) {
		bytes = jvm.fetchBytes("scala-classes/" + className + ".class");
	} else if ("jline/" == className.substring(0,6)) {
		bytes = jvm.fetchBytes("classes-jline/" + className + ".class");
	} else if ("java" == className.substring(0, 4) ||
			"sun/" == className.substring(0, 4) || "com/apple" == className.substring(0, 9)) {
		bytes = jvm.fetchBytes("classes/" + className.replace(/en_$/, "en") + ".class");
	} else {
		bytes = jvm.fetchBytes("bin/" + className + ".class");
	}
	
	if(!(bytes[0] == 0xCA && bytes[1] == 0xFE && bytes[2] == 0xBA && bytes[3] == 0xBE)) {
		throw "Not a class file";
	}
	
	var pos = 4;
	
	function u2() {
		return 256*bytes[pos++] + bytes[pos++];
	}
	
	function u4() {
		return 256*256*256*bytes[pos++] + 256*256*bytes[pos++] + 256*bytes[pos++] + bytes[pos++];
	}
	
	function u1() {
		return bytes[pos++];
	}
	
	function utf8string() {
		var len = u2();
		var end = pos + len;
		var chars = [];
		while (pos < end) {
			var x = bytes[pos++];
			if (x < 0x80) {
				chars.push(String.fromCharCode(x));
			} else {
				var y = bytes[pos++];
				if ((x & 0xe0) == 0xc0) {
					chars.push(String.fromCharCode(((x & 0x1f) << 6) + (y & 0x3f)));
				} else if ((x & 0xf0) == 0xe0) {
					var z = bytes[pos++];
					chars.push(String.fromCharCode(((x & 0xf) << 12) + ((y & 0x3f) << 6) + (z & 0x3f)));
				} else {
					throw "Illegal unicode character";
				}
			}
		}
		return chars.join('');
	}
	
	function utf8string_old() {
		var len = u2();
		var str = '';
		var end = pos + len;
		for ( ; pos < end; pos++)
//			str += bytes[pos] <= 0x7F ? bytes[pos] === 0x25 ? "%25" : // %
//			String.fromCharCode(bytes[pos]) : "%" + bytes[pos].toString(16).toUpperCase();
			str += bytes[pos] > 15 ? "%" + bytes[pos].toString(16).toUpperCase() : "%0" + bytes[pos].toString(16).toUpperCase();
		try {
			return decodeURIComponent(str);
		} catch (e) {
			debugger;
//			console.log(len);
//			throw e;
		}
	}
	
	
	u2(); // console.log("minorversion=" + u2());
	u2(); // console.log("majorversion=" + u2());
	
	var constant_pool_count = u2();
//	console.log("pool count = " + constant_pool_count);
	var constant_pool = [null];
	var constant_pool_types = [null];
	while(constant_pool.length < constant_pool_count) {
		var type = u1();
		constant_pool_types.push(type);
		switch(type) {
		case 0:
			pos--;
			break;
		case 7:
			var name_index = u2();
			constant_pool.push(name_index);
			break;
		case 9:
		case 10:
		case 11:
			var class_index = u2();
			var name_and_type_index = u2();
			constant_pool.push({class_index:class_index, name_and_type_index: name_and_type_index});
			break;
		case 8: // string
			constant_pool.push(u2());
			break;
		case 3: // int
			var val = u4();
			constant_pool.push((val > 0x7FFFFFFF) ? - (0xFFFFFFFF - val) - 1 : val);
			break;
		case 4: // float
			var b = u4();
			switch(true) {
			case (b == 0x7f800000):
				constant_pool.push(Number.POSITIVE_INFINITY);
				break;
			case (b == 0xff800000):
				constant_pool.push(Number.NEGATIVE_INFINITY);
				break;
			case ((b >= 0x7f800001 && b <= 0x7fffffff) || (b > 0xff800001 && b <= 0xffffffff)):
				constant_pool.push(NaN);
				break;
			default:
				var s = ((b >> 31) == 0) ? 1 : -1;
				var e = ((b >> 23) & 0xff);
				var m = (e == 0) ?
	    			(b & 0x7fffff) << 1 :
	    			(b & 0x7fffff) | 0x800000;
				constant_pool.push(s * m * Math.pow(2, e - 150));
				break;
			}
			break;
		case 5: // Long
			var high_bytes = u4();
			var low_bytes = u4();
			constant_pool.push(new Long(low_bytes, high_bytes));
			constant_pool.push(null);
			constant_pool_types.push(null);
			break;
		case 6: // Double
			var high_bytes = u4();
			var low_bytes = u4();
			switch(true) {
				case (high_bytes == 0x7ff00000 && low_bytes == 0):
					constant_pool.push(Number.POSITIVE_INFINITY);
					break;
				case (high_bytes == 0xfff00000 && low_bytes == 0):
					constant_pool.push(Number.NEGATIVE_INFINITY);
					break;
				case (high_bytes > 0x7ff00000 && high_bytes <= 0x7fffffff):
					constant_pool.push(NaN);
					break;
				case (high_bytes > 0xfff00000 && high_bytes <= 0xffffffff):
					constant_pool.push(NaN);
					break;
				default:
					var s = ((high_bytes >> 31) == 0) ? 1 : -1;
		    		var e = ((high_bytes >> 20) & 0x7ff);
		    		var m = (e == 0) ?
			    		(((high_bytes & 0xfffff)) + low_bytes * Math.pow(2, -32)) << 1 :
			    		((high_bytes & 0xfffff | 0x100000) + (low_bytes * Math.pow(2, -32)));
		    		constant_pool.push(s * m * Math.pow(2, e - 1043));
					break;
			}
			constant_pool.push(null);
			constant_pool_types.push(null);
			break;
		case 12:
			var name_index = u2();
			var descriptor_index = u2();
			constant_pool.push({name_index:name_index, descriptor_index:descriptor_index});
			break;
		case 1:
			var string = utf8string();
			constant_pool.push(string);
			break;
		default:
			console.log("UNKNOWN constant TYPE " + type + " at index " + constant_pool.length);
		}
	}
	var access_flags = u2();
//	var acc = [];
//	if (access_flags & 0x0001) {
//		acc.push("public")
//	}
//	if (access_flags & 0x0010) {
//		acc.push("final")
//	}
//	if (access_flags & 0x0020) {
//		acc.push("super")
//	}
//	if (access_flags & 0x0200) {
//		acc.push("interface")
//	}
//	if (access_flags & 0x0400) {
//		acc.push("abstract")
//	}
//	console.log("access_flags: " + acc.join(" "));
	
	var name = constant_pool[constant_pool[u2()]]; // console.log("this_class:" + constant_pool[u2()]);
	var superClass = constant_pool[constant_pool[u2()]]; // console.log("extends " + constant_pool[u2()]);
	var interfaces_count = u2();

	//	console.log("interfaces_count:" + interfaces_count);
	var interfaces = [];
	for(var i = 0; i < interfaces_count; i++) {
		interfaces.push(constant_pool[constant_pool[u2()]]); //console.log("implements " + constant_pool[u2()]);
	}
	
	function processAttributes() {
		var attributes_count = u2();
		for(var j = 0; j < attributes_count; j++) {
			var attribute_name_index = u2();
//			console.log("attribute: " + );
			var attribute_length = u4();
			pos += attribute_length;
		}
	}
	
	var fields = {};
	var fields_count = u2();
	var offset = 0;
//	console.log("fields_count: " + fields_count);
	for(var i = 0; i < fields_count; i++) {
		var _access_flags = u2();
		var name_index = u2();
//		console.log("field: " + constant_pool[name_index - 1]);
		var descriptor_index = u2();
//		console.log("descriptor: " + constant_pool[descriptor_index - 1]);
		var descriptor = constant_pool[descriptor_index];
		fields[constant_pool[name_index]] = {
			access_flags: _access_flags,
			name: constant_pool[name_index],
			descriptor: constant_pool[descriptor_index],
			offset: offset++
		}
		// Find constantvalue
		var attributes_count = u2();

		for(var j = 0; j < attributes_count; j++) {
			var attribute_name_index = u2();
			var attribute_length = u4();
			if ("ConstantValue" == constant_pool[attribute_name_index]) {
				fields[constant_pool[name_index]].constant_value = constant_pool[u2()];
			} else {
				pos += attribute_length;
			}
		}
	}
	
	var methods = {};
	var methods_count = u2();
	for(var i = 0; i < methods_count; i++) {
		var startpos = pos;
		var _access_flags = u2();
		var name_index = u2();
		var descriptor_index = u2();
		
		var codepos = -1;
		
		var attributes_count = u2();
		
		var exception_handlers = [];
		for(var j = 0; j < attributes_count; j++) {
			var attribute_name_index = u2();
			var attribute_length = u4();
			if ("Code" == constant_pool[attribute_name_index]) {
				codepos = pos;
				var max_stack = u2();
				var max_locals = u2();
				var code_length = u4();
				pos += code_length;
				var exception_table_length = u2();
				for(var k = 0; k < exception_table_length; k++) {
					var start_pc = u2();
					var end_pc = u2();
					var handler_pc = u2();
					var catch_type = u2();
					exception_handlers.push({
						start_pc: start_pc,
						end_pc: end_pc,
						handler_pc: handler_pc,
						catch_type: constant_pool[constant_pool[catch_type]]
					});
				}
				processAttributes();
			} else {
				pos += attribute_length;
			}
		}
		
		var descriptor = constant_pool[descriptor_index];
		var paramTypes = [];
		var returnType = null;
		var prefix = "";
		for(var j = 0; j < descriptor.length; j++) {
			switch(descriptor[j]) {
			case "(":
				continue;
			case "[":
				prefix += "[";
				continue;
			case "L": // Object
				var scpos = descriptor.indexOf(";", j);
				paramTypes.push(prefix + descriptor.substring(j, scpos + 1));
				prefix = "";
				j = scpos;
				continue;
			case ")":
				returnType = descriptor.substring(j + 1);
				j = descriptor.length;
				break;
			default:
				paramTypes.push(prefix + descriptor[j]);
				prefix = "";
			}
		}
		
		methods[constant_pool[name_index] + constant_pool[descriptor_index]] = {
				pos: startpos,
				codepos: codepos,
				descriptor: descriptor,
				name: constant_pool[name_index],
				access_flags: _access_flags,
				paramTypes: paramTypes,
				returnType: returnType,
				exception_handlers: exception_handlers,
				toString: function() {
					return this.name + this.descriptor;
				}
			};
	}
	
	
	processAttributes();
	
//	var attributes_count = u2();
//	console.log("attributes count: " + attributes_count);
//	for(var i = 0; i < attributes_count; i++) {
//		var attribute_name_index = u2();
//		console.log("attribute: " + constant_pool[attribute_name_index - 1]);
//		var attribute_length = u4();
//		pos += attribute_length;
//	}
	
	jvm.classes[name] = {
		name: name,
		superClass: superClass,
		interfaces: interfaces,
		access_flags: access_flags,
		methods: methods,
		fields: fields,
		fieldvalues: {},
		bytes: bytes,
		constant_pool: constant_pool,
		constant_pool_types: constant_pool_types,
		toString: function() {
			return name;
		}
	}
	return jvm.classes[name];
};

function getXMLHttpRequest() 
{
    if (window.XMLHttpRequest) {
        return new window.XMLHttpRequest;
    }
    else {
        try {
            return new ActiveXObject("MSXML2.XMLHTTP"); 
        }
        catch(ex) {
            return null;
        }
    }
}


if(/msie/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent)) {
    var IEBinaryToArray_ByteStr_Script =
    "<!-- IEBinaryToArray_ByteStr -->\r\n"+
    "<script type='text/vbscript'>\r\n"+
    "Function IEBinaryToArray_ByteStr(Binary)\r\n"+
    "   IEBinaryToArray_ByteStr = CStr(Binary)\r\n"+
    "End Function\r\n"+
    "Function IEBinaryToArray_ByteStr_Last(Binary)\r\n"+
    "   Dim lastIndex\r\n"+
    "   lastIndex = LenB(Binary)\r\n"+
    "   if lastIndex mod 2 Then\r\n"+
    "       IEBinaryToArray_ByteStr_Last = Chr( AscB( MidB( Binary, lastIndex, 1 ) ) )\r\n"+
    "   Else\r\n"+
    "       IEBinaryToArray_ByteStr_Last = "+'""'+"\r\n"+
    "   End If\r\n"+
    "End Function\r\n"+
    "</script>\r\n";

    // inject VBScript
    document.write(IEBinaryToArray_ByteStr_Script);
}

if(/msie/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent)) {
	// this fn is invoked if IE
jvm.fetchBytes = function (fileURL){
	var that = this;
    var req = getXMLHttpRequest();
    req.open("GET", fileURL, false);
    req.setRequestHeader("Accept-Charset", "x-user-defined");
    req.send();
    var fileContents = convertResponseBodyToText(req.responseBody);
    var fileSize = fileContents.length-1;
    if(fileSize < 0) throwException(_exception.FileLoadFailed);
    // my helper to convert from responseBody to a "responseText" like thing
    function convertResponseBodyToText(binary) {
        var byteMapping = {};
        for ( var i = 0; i < 256; i++ ) {
            for ( var j = 0; j < 256; j++ ) {
                byteMapping[ String.fromCharCode( i + j * 256 ) ] =
                    String.fromCharCode(i) + String.fromCharCode(j);
            }
        }
        // call into VBScript utility fns
        var rawBytes = IEBinaryToArray_ByteStr(binary);
        var lastChr = IEBinaryToArray_ByteStr_Last(binary);
        return rawBytes.replace(/[\s\S]/g, function( match ) { return byteMapping[match]; }) + lastChr;
    };
	var bytes = [];
	var len = fileContents.length;
	for ( var i = 0; i < len; i++) {
		bytes.push(fileContents.charCodeAt(i) & 0xff);
	}
	return bytes;
}

} else {



jvm.fetchBytes = function(url) {
	var req = new XMLHttpRequest();
	req.open('GET', url, false);
	
	// XHR binary charset opt by Marcus Granado 2006 [http://mgran.blogspot.com]
	req.overrideMimeType('text/plain; charset=x-user-defined');
	req.send(null);
	
	if (req.status != 200) {
		debugger;
		throwException("Could not load file");
	}
	
	var fileContents = req.responseText;
	
	var bytes = [];
	var len = fileContents.length;
	for ( var i = 0; i < len; i++) {
		bytes.push(fileContents.charCodeAt(i) & 0xff);
	}
	return bytes;
}

}

jvm.reader = function(bytes, pos) {
	return {
		u1: function() {
			return bytes[pos++];
		},
		
		u2: function() {
			return 256*bytes[pos++] + bytes[pos++];
		},
		
		u4: function() {
			return 256*256*256*bytes[pos++] + 256*256*bytes[pos++] + 256*bytes[pos++] + bytes[pos++];
		},
	
		utf8string: function() {
			var str = '';
			var end = pos + (256*bytes[pos++] + bytes[pos++]);
			for ( ; pos < end; pos++)
				str += bytes[pos] <= 0x7F ? bytes[pos] === 0x25 ? "%25" : // %
				String.fromCharCode(bytes[pos]) : "%" + bytes[pos].toString(16).toUpperCase();
			return decodeURIComponent(str);
		},
		
		getPos: function() {
			return pos;
		}
	};
};



jvm.getClassFromDescriptor = function(descriptor) {
	switch(descriptor[0]) {
	case 'L':
		var classname = descriptor.substring(1, descriptor.length - 1);
		return jvm.getClassClass('object', jvm.loadClass(classname));
	case 'I':
		return jvm.getPrimitiveClass('int');
	case 'J':
		return jvm.getPrimitiveClass('long');
	case 'V':
		return jvm.getPrimitiveClass('void');
	case 'Z':
		return jvm.getPrimitiveClass('boolean');
	case 'D':
		return jvm.getPrimitiveClass('double');
	case 'F':
		return jvm.getPrimitiveClass('float');
	case 'B':
		return jvm.getPrimitiveClass('byte');
	case 'C':
		return jvm.getPrimitiveClass('char');
	case '[':
		return jvm.getClassClass('array', jvm.getClassFromDescriptor(descriptor.substring(1)));
	}
};

jvm.getDescriptorFromClass = function(clazz) {
	if (clazz.theType == 'object') {
		return "L" + clazz.theClazz.name + ";";
	} else if (clazz.theType == 'array') {
		return "[" + jvm.getDescriptorFromClass(clazz.componentClass);
	} else {
		debugger;
	}
};

jvm.primitiveClasses = {};

jvm.createPrimitiveClass = function(theType) {
	var classclazz = jvm.loadClass("java/lang/Class");
	return {
		theType : theType,
		theClazz : null,
		clazz : classclazz,
		fields : {
			name: theType
		},
		private_fields : {},
		type : 'object'
	};
}

jvm.getPrimitiveClass = function(str) {
	if (!this.primitiveClasses[str]) {
		this.primitiveClasses[str] = this.createPrimitiveClass(str);
	}
	return this.primitiveClasses[str];
}


jvm.classclasses = {};

jvm.getClassClass = function(theType, theClazz) {
	var key = theType + ":" + theClazz.name;
	if (!jvm.classclasses[key]) {
		var result;
		var classclazz = jvm.loadClass("java/lang/Class");
		if (theType == 'array') {
			result = {
				theType : theType,
				theClazz : null,
				componentClass : theClazz,
				clazz : classclazz,
				fields : {},
				private_fields : {},
				type : 'object'
			};
		} else {
			result = {
				theType : theType,
				theClazz : theClazz,
				componentClass : null,
				clazz : classclazz,
				fields : {},
				private_fields : {},
				type : 'object'
			}
		}
		jvm.classclasses[key] = result;
	}
	return jvm.classclasses[key];
}

