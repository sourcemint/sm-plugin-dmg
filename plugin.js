
const PATH = require("path");
const SPAWN = require("child_process").spawn;


exports.for = function(API, plugin) {

    plugin.resolveLocator = function(locator, options, callback) {
        var self = this;

        if (!locator.url) {
            locator.url = locator.descriptor.pointer;
        }

        locator.getLocation = function(type) {
            var locations = {
                "pointer": locator.url
            };
            // NOTE: Assuming DMG url.
            locations.dmg = locator.url;
            return (type)?locations[type]:locations;
        }

        return callback(null, locator);
    }

    plugin.extract = function(fromPath, toPath, locator, options) {

        // @credit http://superuser.com/a/250624

        var cdrPath = fromPath + "~.cdr";
        var mountPath = toPath + "~mount";

        function convert() {
            if (PATH.existsSync(cdrPath)) return API.Q.resolve(null);
            options.logger.info("Converting dmg '" + fromPath + "' to cdr.");
            return API.OS.spawnInline("/usr/bin/hdiutil", [
                "convert", "-quiet", fromPath, "-format", "UDTO", "-o", fromPath + "~"
            ], {
                cwd: PATH.dirname(fromPath)
            });
        }

        function mount() {
            options.logger.info("Mount cdr '" + cdrPath + "' to '" + mountPath + "'.");
            return API.OS.spawnInline("/usr/bin/hdiutil", [
                "attach", "-quiet", "-nobrowse", "-noverify", "-noautoopen", "-mountpoint", mountPath, cdrPath
            ], {
                cwd: PATH.dirname(fromPath)
            });
        }

        function unmount() {
            options.logger.info("Unmounting '" + mountPath + "'.");
            return API.OS.spawnInline("/usr/bin/hdiutil", [
                "detach", mountPath
            ], {
                cwd: PATH.dirname(fromPath)
            });
        }

        function extract() {
            options.logger.info("Extracting '" + mountPath + "' to '" + toPath + "'.");
            var deferred = API.Q.defer();
            API.COPY(mountPath, toPath, {
                filter: function(path) {
                    if (/\/.Trashes$/.test(path)) return false;
                    return true;
                }
            }, function (err) {
                if (err) return deferred.reject(err);
                return deferred.resolve();
            });
            return deferred.promise;
        }

        return convert().then(function() {
            return mount().then(function() {
                return extract().then(function() {
                    return 200;
                });
            }).then(function() {
                return unmount();
            }, function(err) {
                return unmount().then(function() {
                    throw err;
                });
            });
        });
    };
}
