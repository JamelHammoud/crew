import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { IosCreateRequest, IosCreateResult } from '../shared/ios'

const NAME = /^[A-Za-z][A-Za-z0-9 _-]{0,48}$/
const BUNDLE = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/

function quoted(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function sourceName(name: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? []
  const joined = words.map(word => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`).join('')
  return /^\d/.test(joined) ? `App${joined}` : joined || 'App'
}

export function iosProjectPbx(name: string, bundleId: string): string {
  const product = `${name}.app`
  return `{
  archiveVersion = 1;
  classes = {};
  objectVersion = 56;
  objects = {
    A00000000000000000000001 = {isa = PBXBuildFile; fileRef = B00000000000000000000001; };
    A00000000000000000000002 = {isa = PBXBuildFile; fileRef = B00000000000000000000002; };
    A00000000000000000000003 = {isa = PBXBuildFile; fileRef = B00000000000000000000003; };
    B00000000000000000000001 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${quoted(`${sourceName(name)}App.swift`)}; sourceTree = "<group>"; };
    B00000000000000000000002 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
    B00000000000000000000003 = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
    B00000000000000000000004 = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ${quoted(product)}; sourceTree = BUILT_PRODUCTS_DIR; };
    C00000000000000000000001 = {
      isa = PBXFrameworksBuildPhase;
      buildActionMask = 2147483647;
      files = ();
      runOnlyForDeploymentPostprocessing = 0;
    };
    C00000000000000000000002 = {
      isa = PBXResourcesBuildPhase;
      buildActionMask = 2147483647;
      files = (A00000000000000000000003,);
      runOnlyForDeploymentPostprocessing = 0;
    };
    C00000000000000000000003 = {
      isa = PBXSourcesBuildPhase;
      buildActionMask = 2147483647;
      files = (A00000000000000000000001, A00000000000000000000002,);
      runOnlyForDeploymentPostprocessing = 0;
    };
    D00000000000000000000001 = {
      isa = PBXGroup;
      children = (D00000000000000000000002, D00000000000000000000003,);
      sourceTree = "<group>";
    };
    D00000000000000000000002 = {
      isa = PBXGroup;
      children = (B00000000000000000000001, B00000000000000000000002, B00000000000000000000003,);
      path = ${quoted(name)};
      sourceTree = "<group>";
    };
    D00000000000000000000003 = {
      isa = PBXGroup;
      children = (B00000000000000000000004,);
      name = Products;
      sourceTree = "<group>";
    };
    E00000000000000000000001 = {
      isa = PBXNativeTarget;
      buildConfigurationList = F00000000000000000000002;
      buildPhases = (C00000000000000000000003, C00000000000000000000001, C00000000000000000000002,);
      buildRules = ();
      dependencies = ();
      name = ${quoted(name)};
      productName = ${quoted(name)};
      productReference = B00000000000000000000004;
      productType = "com.apple.product-type.application";
    };
    E00000000000000000000002 = {
      isa = PBXProject;
      attributes = {
        BuildIndependentTargetsInParallel = 1;
        LastSwiftUpdateCheck = 1600;
        LastUpgradeCheck = 1600;
        TargetAttributes = {E00000000000000000000001 = {CreatedOnToolsVersion = 16.0; };};
      };
      buildConfigurationList = F00000000000000000000001;
      compatibilityVersion = "Xcode 14.0";
      developmentRegion = en;
      hasScannedForEncodings = 0;
      knownRegions = (en, Base,);
      mainGroup = D00000000000000000000001;
      productRefGroup = D00000000000000000000003;
      projectDirPath = "";
      projectRoot = "";
      targets = (E00000000000000000000001,);
    };
    F00000000000000000000001 = {
      isa = XCConfigurationList;
      buildConfigurations = (F00000000000000000000003, F00000000000000000000004,);
      defaultConfigurationIsVisible = 0;
      defaultConfigurationName = Release;
    };
    F00000000000000000000002 = {
      isa = XCConfigurationList;
      buildConfigurations = (F00000000000000000000005, F00000000000000000000006,);
      defaultConfigurationIsVisible = 0;
      defaultConfigurationName = Release;
    };
    F00000000000000000000003 = {
      isa = XCBuildConfiguration;
      buildSettings = {
        ALWAYS_SEARCH_USER_PATHS = NO;
        CLANG_ENABLE_MODULES = YES;
        CLANG_ENABLE_OBJC_ARC = YES;
        DEBUG_INFORMATION_FORMAT = dwarf;
        ENABLE_TESTABILITY = YES;
        GCC_C_LANGUAGE_STANDARD = gnu17;
        GCC_OPTIMIZATION_LEVEL = 0;
        IPHONEOS_DEPLOYMENT_TARGET = 18.0;
        MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
        ONLY_ACTIVE_ARCH = YES;
        SDKROOT = iphoneos;
        SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
        SWIFT_OPTIMIZATION_LEVEL = "-Onone";
      };
      name = Debug;
    };
    F00000000000000000000004 = {
      isa = XCBuildConfiguration;
      buildSettings = {
        ALWAYS_SEARCH_USER_PATHS = NO;
        CLANG_ENABLE_MODULES = YES;
        CLANG_ENABLE_OBJC_ARC = YES;
        DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
        GCC_C_LANGUAGE_STANDARD = gnu17;
        IPHONEOS_DEPLOYMENT_TARGET = 18.0;
        MTL_ENABLE_DEBUG_INFO = NO;
        SDKROOT = iphoneos;
        SWIFT_COMPILATION_MODE = wholemodule;
      };
      name = Release;
    };
    F00000000000000000000005 = {
      isa = XCBuildConfiguration;
      buildSettings = {
        ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
        CODE_SIGN_STYLE = Automatic;
        CURRENT_PROJECT_VERSION = 1;
        GENERATE_INFOPLIST_FILE = YES;
        INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
        INFOPLIST_KEY_UILaunchScreen_Generation = YES;
        LD_RUNPATH_SEARCH_PATHS = ("$(inherited)", "@executable_path/Frameworks",);
        MARKETING_VERSION = 1.0;
        PRODUCT_BUNDLE_IDENTIFIER = ${quoted(bundleId)};
        PRODUCT_NAME = "$(TARGET_NAME)";
        SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";
        SUPPORTS_MACCATALYST = NO;
        SWIFT_EMIT_LOC_STRINGS = YES;
        SWIFT_VERSION = 5.0;
        TARGETED_DEVICE_FAMILY = "1,2";
      };
      name = Debug;
    };
    F00000000000000000000006 = {
      isa = XCBuildConfiguration;
      buildSettings = {
        ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
        CODE_SIGN_STYLE = Automatic;
        CURRENT_PROJECT_VERSION = 1;
        GENERATE_INFOPLIST_FILE = YES;
        INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
        INFOPLIST_KEY_UILaunchScreen_Generation = YES;
        LD_RUNPATH_SEARCH_PATHS = ("$(inherited)", "@executable_path/Frameworks",);
        MARKETING_VERSION = 1.0;
        PRODUCT_BUNDLE_IDENTIFIER = ${quoted(bundleId)};
        PRODUCT_NAME = "$(TARGET_NAME)";
        SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";
        SUPPORTS_MACCATALYST = NO;
        SWIFT_EMIT_LOC_STRINGS = YES;
        SWIFT_VERSION = 5.0;
        TARGETED_DEVICE_FAMILY = "1,2";
      };
      name = Release;
    };
  };
  rootObject = E00000000000000000000002;
}
`
}

function swiftApp(name: string): string {
  return `import SwiftUI

@main
struct ${sourceName(name)}App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
`
}

const CONTENT_VIEW = `import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.3.fill")
                .font(.system(size: 36))
            Text("Built with Crew")
                .font(.title2.weight(.semibold))
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
`

const ASSETS = JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) + '\n'
const ACCENT =
  JSON.stringify({ colors: [{ idiom: 'universal' }], info: { author: 'xcode', version: 1 } }, null, 2) + '\n'
const APP_ICON =
  JSON.stringify(
    {
      images: [
        { idiom: 'universal', platform: 'ios', size: '1024x1024' },
        {
          appearances: [{ appearance: 'luminosity', value: 'dark' }],
          idiom: 'universal',
          platform: 'ios',
          size: '1024x1024'
        },
        {
          appearances: [{ appearance: 'luminosity', value: 'tinted' }],
          idiom: 'universal',
          platform: 'ios',
          size: '1024x1024'
        }
      ],
      info: { author: 'xcode', version: 1 }
    },
    null,
    2
  ) + '\n'

export async function createIosProject(folder: string, input: IosCreateRequest): Promise<IosCreateResult> {
  const name = input.name.trim()
  const bundleId = input.bundleId.trim()
  if (!NAME.test(name)) return { ok: false, message: 'Use a project name that starts with a letter.' }
  if (!BUNDLE.test(bundleId)) return { ok: false, message: 'Use a bundle ID such as com.example.app.' }
  const root = path.join(folder, name)
  try {
    await access(root)
    return { ok: false, message: 'A folder with that name already exists.' }
  } catch {}
  const source = path.join(root, name)
  const assets = path.join(source, 'Assets.xcassets')
  const projectPath = path.join(root, `${name}.xcodeproj`)
  try {
    await mkdir(path.join(assets, 'AccentColor.colorset'), { recursive: true })
    await mkdir(path.join(assets, 'AppIcon.appiconset'), { recursive: true })
    await mkdir(projectPath, { recursive: true })
    await Promise.all([
      writeFile(path.join(projectPath, 'project.pbxproj'), iosProjectPbx(name, bundleId)),
      writeFile(path.join(source, `${sourceName(name)}App.swift`), swiftApp(name)),
      writeFile(path.join(source, 'ContentView.swift'), CONTENT_VIEW),
      writeFile(path.join(assets, 'Contents.json'), ASSETS),
      writeFile(path.join(assets, 'AccentColor.colorset', 'Contents.json'), ACCENT),
      writeFile(path.join(assets, 'AppIcon.appiconset', 'Contents.json'), APP_ICON)
    ])
    return { ok: true, projectPath }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The project could not be created.' }
  }
}
